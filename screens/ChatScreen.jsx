import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '../AuthContext';
import { apiUrl } from '../api';

const colors = {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    ink: '#17212B',
    muted: '#7D8792',
    accent: '#287A70',
    accentSoft: '#E4F2EF',
    line: '#E8EBEF',
    danger: '#B54747',
};

const MAX_IMAGE_PAYLOAD_CHARS = 90 * 1024;
const IMAGE_COMPRESSION_PRESETS = [
    { maxDimension: 1280, quality: 0.72 },
    { maxDimension: 800, quality: 0.58 },
    { maxDimension: 512, quality: 0.45 },
];

const toImageUri = (imageInfo) => {
    if (!imageInfo) return null;
    if (/^(data:|https?:|file:)/i.test(imageInfo)) return imageInfo;
    return `data:image/jpeg;base64,${imageInfo}`;
};

const compressImageForUpload = async (asset) => {
    for (const preset of IMAGE_COMPRESSION_PRESETS) {
        const manipulator = ImageManipulator.manipulate(asset.uri, {
            maxWidth: preset.maxDimension,
            maxHeight: preset.maxDimension,
        });

        if (asset.width > 0 && asset.height > 0) {
            const scale = Math.min(
                1,
                preset.maxDimension / Math.max(asset.width, asset.height),
            );
            if (scale < 1) {
                manipulator.resize({
                    width: Math.round(asset.width * scale),
                    height: Math.round(asset.height * scale),
                });
            }
        }

        const renderedImage = await manipulator.renderAsync();
        const compressedImage = await renderedImage.saveAsync({
            format: SaveFormat.JPEG,
            compress: preset.quality,
            base64: true,
        });

        if (!compressedImage.base64) {
            throw new Error('Image compression did not return image data');
        }
        if (compressedImage.base64.length <= MAX_IMAGE_PAYLOAD_CHARS) {
            return compressedImage;
        }
    }

    throw new Error('Image exceeds the upload size limit after compression');
};

const ensureResponseOk = async (response, action) => {
    if (response.ok) return;
    const details = await response.text();
    throw new Error(
        `${action} failed (${response.status})${details ? `: ${details}` : ''}`,
    );
};

const SharedImage = ({ source }) => {
    const [loadFailed, setLoadFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [localUri, setLocalUri] = useState(null);
    const uri = source?.uri;
    const authorization = source?.headers?.Authorization;

    useEffect(() => {
        let cancelled = false;
        if (!uri || !authorization) return undefined;

        const loadImage = async () => {
            try {
                const response = await expoFetch(uri, {
                    headers: { Authorization: authorization },
                });
                if (!response.ok) {
                    const details = await response.text();
                    throw new Error(
                        `Image download failed (${response.status})${details ? `: ${details}` : ''}`,
                    );
                }

                const bytes = await response.bytes();
                const mimeType = response.headers
                    .get('content-type')
                    ?.split(';', 1)[0]
                    .toLowerCase();
                const extension = {
                    'image/gif': 'gif',
                    'image/heic': 'heic',
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/webp': 'webp',
                }[mimeType] ?? 'jpg';
                const cachedImage = new File(
                    Paths.cache,
                    `shared-image-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
                );
                await cachedImage.write(bytes);

                if (!cancelled) setLocalUri(cachedImage.uri);
            } catch (error) {
                console.error('Unable to display shared image:', error);
                if (!cancelled) setLoadFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadImage();
        return () => {
            cancelled = true;
        };
    }, [authorization, uri]);

    if (loadFailed) {
        return (
            <View style={styles.imageUnavailable}>
                <Text style={styles.imageUnavailableText}>Image unavailable</Text>
            </View>
        );
    }

    if (authorization && (loading || !localUri)) {
        return (
            <View style={styles.imageUnavailable}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    return (
        <Image
            source={{ uri: authorization ? localUri : uri }}
            accessibilityLabel="Shared image"
            style={styles.messageImage}
            resizeMode="contain"
            onError={(event) => {
                console.error('Unable to display shared image:', event.nativeEvent.error);
                setLoadFailed(true);
            }}
        />
    );
};

const ChatScreen = ({ route }) => {
    const conversation = route.params.data;
    const { authorization } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [currentMessage, setCurrentMessage] = useState('');
    const [participantsName, setParticipantsName] = useState([]);
    const [imageUri, setImageUri] = useState(null);
    const [imageStatus, setImageStatus] = useState('');
    const [pendingImageBase64, setPendingImageBase64] = useState(null);
    const [pendingUploadedFileId, setPendingUploadedFileId] = useState(null);

    const fetchMessages = useCallback(async () => {
        const response = await fetch(
            apiUrl(`/message?conversation_id=${conversation.conversationId}`),
            {
                headers: { authorization },
            },
        );
        const data = await response.json();
        return Array.isArray(data?.data) ? data.data : [];
    }, [authorization, conversation.conversationId]);

    useEffect(() => {
        let isMounted = true;
        Promise.all([
            fetchMessages(),
            Promise.all(
                (conversation.participants ?? []).map((participantId) =>
                    fetch(
                        apiUrl(`/user/profile?user_id=${participantId}`),
                        {
                            method: 'GET',
                            headers: { Authorization: authorization },
                        },
                    ).then((response) => response.json()),
                ),
            ),
        ])
            .then(([messageData, profiles]) => {
                if (!isMounted) return;
                setMessages(messageData);
                setParticipantsName(profiles.map((profile) => profile.name).filter(Boolean));
                setError('');
            })
            .catch((err) => {
                if (isMounted) setError('Unable to load this conversation. Please try again.');
                console.error('Unable to load chat:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [authorization, conversation.participants, fetchMessages]);

    const sendMessage = async () => {
        const content = currentMessage.trim();
        if (!content || sending) return;

        setSending(true);
        setError('');
        try {
            const response = await fetch(apiUrl('/message'), {
                method: 'POST',
                headers: {
                    Authorization: authorization,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversation_id: conversation.conversationId,
                    content,
                }),
            });
            await response.json();
            setCurrentMessage('');
            setMessages(await fetchMessages());
        } catch (err) {
            setError('Your message could not be sent. Please try again.');
            console.error('Unable to send message:', err);
        } finally {
            setSending(false);
        }
    };

    const sendImage = async (base64, existingFileId = null) => {
        if (!base64 || sending) return;

        setSending(true);
        setError('');
        setImageStatus('sending');
        try {
            let fileId = existingFileId;
            if (!fileId) {
                const uploadResponse = await fetch(apiUrl('/file'), {
                    method: 'POST',
                    headers: {
                        Authorization: authorization,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        file_name: `photo-${Date.now()}.jpg`,
                        mime_type: 'image/jpeg',
                        data: `data:image/jpeg;base64,${base64}`,
                    }),
                });
                await ensureResponseOk(uploadResponse, 'Image upload');
                const uploadedFile = await uploadResponse.json();
                if (!uploadedFile?.id) {
                    throw new Error('Image upload response did not include a file id');
                }
                fileId = uploadedFile.id;
                setPendingUploadedFileId(fileId);
            }

            const messageResponse = await fetch(apiUrl('/message'), {
                method: 'POST',
                headers: {
                    Authorization: authorization,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversation_id: conversation.conversationId,
                    file_id: fileId,
                }),
            });
            await ensureResponseOk(messageResponse, 'Sending photo');

            setImageStatus('sent');
            setPendingImageBase64(null);
            setPendingUploadedFileId(null);
            try {
                setMessages(await fetchMessages());
            } catch (refreshError) {
                setError('Photo sent, but messages could not be refreshed.');
                console.error('Unable to refresh messages after sending photo:', refreshError);
            }
        } catch (err) {
            setImageStatus('failed');
            setError(
                err.message.includes('(413)')
                    ? 'This photo is too large to send. Choose a smaller image.'
                    : 'Your photo could not be sent. Check your connection and try again.',
            );
            console.error('Unable to send photo:', err);
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(
                    'Permission required',
                    'Allow photo library access to share an image.',
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];
            const compressedImage = await compressImageForUpload(asset);

            setImageUri(compressedImage.uri);
            setImageStatus('sending');
            setPendingImageBase64(compressedImage.base64);
            setPendingUploadedFileId(null);
            await sendImage(compressedImage.base64);
        } catch (err) {
            if (err.message === 'Image exceeds the upload size limit after compression') {
                setImageStatus('failed');
                setError('This photo is still too large to send. Choose a smaller image.');
            } else if (err.message === 'Image compression did not return image data') {
                setImageStatus('failed');
                setError('We couldn’t prepare this photo for sending. Please choose another.');
            } else {
                setError('We couldn’t prepare this photo. Please try again.');
            }
            console.error('Unable to prepare image for sending:', err);
        }
    };

    const renderMessage = ({ item }) => {
        const fileDownloadUrl = item.file?.downloadUrl;
        const imageUri = toImageUri(item.imageInfo) ?? fileDownloadUrl;
        const isAuthenticatedDownload = imageUri === fileDownloadUrl;
        const imageSource = imageUri
            ? {
                  uri:
                      isAuthenticatedDownload && !/^https?:/i.test(imageUri)
                          ? apiUrl(imageUri)
                          : imageUri,
                  ...(isAuthenticatedDownload
                      ? { headers: { Authorization: authorization } }
                      : {}),
              }
            : null;
        const content = item.content ?? item.text;

        return (
            <View style={styles.messageRow}>
                <View style={styles.messageBubble}>
                    {imageSource ? (
                        <SharedImage source={imageSource} />
                    ) : item.type === 'IMAGE' ? (
                        <View style={styles.imageUnavailable}>
                            <Text style={styles.imageUnavailableText}>Image unavailable</Text>
                        </View>
                    ) : null}
                    {content ? <Text style={styles.messageText}>{content}</Text> : null}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <View style={styles.participantsBar}>
                <View style={styles.onlineDot} />
                <Text style={styles.participantsText} numberOfLines={1}>
                    {participantsName.length
                        ? participantsName.join(', ')
                        : 'Your conversation'}
                </Text>
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.loadingText}>Loading messages…</Text>
                </View>
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => String(item.id ?? index)}
                    contentContainerStyle={[
                        styles.messageList,
                        messages.length === 0 && styles.emptyList,
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <Text style={styles.emptyIconText}>Hi</Text>
                            </View>
                            <Text style={styles.emptyTitle}>A fresh start</Text>
                            <Text style={styles.emptyDescription}>
                                Send a message to get the conversation going.
                            </Text>
                        </View>
                    }
                />
            )}

            <View style={styles.composerArea}>
                {imageUri ? (
                    <View style={styles.attachmentPreview}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        <TouchableOpacity
                            accessibilityLabel="Remove photo preview"
                            disabled={sending}
                            onPress={() => {
                                setImageUri(null);
                                setImageStatus('');
                                setPendingImageBase64(null);
                                setPendingUploadedFileId(null);
                            }}
                            style={styles.removePreview}
                        >
                            <Text style={styles.removePreviewText}>×</Text>
                        </TouchableOpacity>
                        <Text style={styles.previewLabel}>
                            {imageStatus === 'sending'
                                ? 'Sending photo…'
                                : imageStatus === 'failed'
                                  ? 'Photo not sent'
                                  : 'Photo sent'}
                        </Text>
                        {imageStatus === 'failed' && pendingImageBase64 ? (
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Retry sending photo"
                                disabled={sending}
                                onPress={() =>
                                    sendImage(pendingImageBase64, pendingUploadedFileId)
                                }
                                style={styles.retryPhotoButton}
                            >
                                <Text style={styles.retryPhotoText}>Retry</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}

                <View style={styles.composer}>
                    <TouchableOpacity
                        accessibilityLabel="Share a photo"
                        activeOpacity={0.75}
                        disabled={sending}
                        onPress={pickImage}
                        style={[styles.addButton, sending && styles.addButtonDisabled]}
                    >
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                    <TextInput
                        accessibilityLabel="Write a message"
                        placeholder="Write a message…"
                        placeholderTextColor={colors.muted}
                        value={currentMessage}
                        onChangeText={setCurrentMessage}
                        style={styles.input}
                        multiline
                        maxLength={2000}
                    />
                    <TouchableOpacity
                        accessibilityLabel="Send message"
                        activeOpacity={0.8}
                        disabled={!currentMessage.trim() || sending}
                        onPress={sendMessage}
                        style={[
                            styles.sendButton,
                            (!currentMessage.trim() || sending) && styles.sendButtonDisabled,
                        ]}
                    >
                        {sending ? (
                            <ActivityIndicator color={colors.surface} size="small" />
                        ) : (
                            <Text style={styles.sendButtonText}>↑</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    participantsBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.line,
        borderBottomWidth: 1,
        flexDirection: 'row',
        minHeight: 44,
        paddingHorizontal: 20,
    },
    onlineDot: {
        backgroundColor: colors.accent,
        borderRadius: 4,
        height: 7,
        marginRight: 9,
        width: 7,
    },
    participantsText: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
    },
    errorBanner: {
        backgroundColor: '#FFF1F0',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    errorText: {
        color: colors.danger,
        fontSize: 13,
    },
    loading: {
        alignItems: 'center',
        flex: 1,
        gap: 12,
        justifyContent: 'center',
    },
    loadingText: {
        color: colors.muted,
        fontSize: 14,
    },
    messageList: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    messageRow: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    messageBubble: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 18,
        borderBottomLeftRadius: 5,
        borderWidth: 1,
        maxWidth: '84%',
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    messageImage: {
        borderRadius: 12,
        height: 190,
        marginBottom: 7,
        width: 220,
    },
    imageUnavailable: {
        alignItems: 'center',
        backgroundColor: '#EEF1F4',
        borderRadius: 12,
        height: 120,
        justifyContent: 'center',
        marginBottom: 4,
        width: 220,
    },
    imageUnavailableText: {
        color: colors.muted,
        fontSize: 13,
    },
    messageText: {
        color: colors.ink,
        fontSize: 15,
        lineHeight: 22,
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    emptyIcon: {
        alignItems: 'center',
        backgroundColor: colors.accentSoft,
        borderRadius: 27,
        height: 54,
        justifyContent: 'center',
        marginBottom: 15,
        width: 54,
    },
    emptyIconText: {
        color: colors.accent,
        fontSize: 17,
        fontWeight: '700',
    },
    emptyTitle: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    emptyDescription: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 7,
        textAlign: 'center',
    },
    composerArea: {
        backgroundColor: colors.surface,
        borderTopColor: colors.line,
        borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 8 : 10,
        paddingHorizontal: 13,
        paddingTop: 10,
    },
    attachmentPreview: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        marginBottom: 10,
        position: 'relative',
    },
    previewImage: {
        borderRadius: 10,
        height: 48,
        width: 48,
    },
    removePreview: {
        alignItems: 'center',
        backgroundColor: colors.ink,
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        left: 34,
        position: 'absolute',
        top: -6,
        width: 20,
    },
    removePreviewText: {
        color: colors.surface,
        fontSize: 16,
        lineHeight: 18,
    },
    previewLabel: {
        color: colors.muted,
        fontSize: 12,
        marginLeft: 12,
    },
    retryPhotoButton: {
        backgroundColor: colors.accentSoft,
        borderRadius: 10,
        marginLeft: 9,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    retryPhotoText: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: '700',
    },
    composer: {
        alignItems: 'flex-end',
        backgroundColor: colors.background,
        borderColor: colors.line,
        borderRadius: 25,
        borderWidth: 1,
        flexDirection: 'row',
        minHeight: 50,
        padding: 5,
    },
    addButton: {
        alignItems: 'center',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    addButtonText: {
        color: colors.accent,
        fontSize: 28,
        fontWeight: '300',
        lineHeight: 32,
    },
    addButtonDisabled: {
        opacity: 0.5,
    },
    input: {
        color: colors.ink,
        flex: 1,
        fontSize: 15,
        maxHeight: 110,
        minHeight: 40,
        paddingHorizontal: 8,
        paddingTop: 10,
        textAlignVertical: 'center',
    },
    sendButton: {
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        marginLeft: 4,
        width: 40,
    },
    sendButtonDisabled: {
        backgroundColor: '#A8C6C1',
    },
    sendButtonText: {
        color: colors.surface,
        fontSize: 22,
        fontWeight: '600',
        lineHeight: 25,
    },
});

export default ChatScreen;
