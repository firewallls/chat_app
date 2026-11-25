import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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

const ConversationScreen = ({ navigation }) => {
    const { authorization } = useAuth();
    const [conversation, setConversation] = useState([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetch(apiUrl('/conversation'), {
            method: 'GET',
            headers: { authorization },
        })
            .then((response) => response.json())
            .then(async (data) => {
                const conversations = await Promise.all(
                    data.map(async (item) => {
                        const response = await fetch(
                            apiUrl(`/user/profile?user_id=${item.createdBy}`),
                            {
                                method: 'GET',
                                headers: { Authorization: authorization },
                            },
                        );
                        const profile = await response.json();
                        return { ...item, createdBy: profile.name };
                    }),
                );

                if (isMounted) {
                    setConversation(conversations);
                    setError('');
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError('We couldn’t load your conversations. Please try again.');
                }
                console.error('Unable to load conversations:', err);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [authorization]);

    const visibleConversations = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return conversation;
        return conversation.filter((item) =>
            `${item.name ?? ''} ${item.createdBy ?? ''}`.toLowerCase().includes(query),
        );
    }, [conversation, search]);

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.heroRow}>
                <View style={styles.intro}>
                    <Text style={styles.eyebrow}>MESSAGES</Text>
                    <Text style={styles.title}>Stay connected</Text>
                    <Text style={styles.subtitle}>Pick up right where you left off.</Text>
                </View>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Start a new conversation"
                    activeOpacity={0.8}
                    onPress={() => navigation.getParent()?.navigate('AllUsers')}
                    style={styles.newChatButton}
                >
                    <Text style={styles.newChatIcon}>+</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
                <Text style={styles.searchMark}>⌕</Text>
                <TextInput
                    accessibilityLabel="Search conversations"
                    placeholder="Search conversations"
                    placeholderTextColor={colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchInput}
                    returnKeyType="search"
                />
            </View>

            <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Your conversations</Text>
                <Text style={styles.count}>{conversation.length}</Text>
            </View>

            {loading ? (
                <View style={styles.stateCard}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.stateText}>Loading conversations…</Text>
                </View>
            ) : error ? (
                <View style={styles.stateCard}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : visibleConversations.length ? (
                <View style={styles.list}>
                    {visibleConversations.map((item, index) => {
                        const name = item.name || 'Untitled conversation';
                        const initials = name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')
                            .toUpperCase();

                        return (
                            <TouchableOpacity
                                key={item.id ?? index}
                                activeOpacity={0.75}
                                style={styles.conversation}
                                onPress={() => {
                                    navigation.navigate('Chat', {
                                        data: {
                                            name: item.name,
                                            conversationId: item.id,
                                            participants: item.participants_ids,
                                        },
                                    });
                                }}
                            >
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{initials || 'C'}</Text>
                                </View>
                                <View style={styles.conversationDetails}>
                                    <Text style={styles.conversationName} numberOfLines={1}>
                                        {name}
                                    </Text>
                                    <Text style={styles.lastMessage} numberOfLines={1}>
                                        {item.createdBy ? `Created by ${item.createdBy}` : 'Open conversation'}
                                    </Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <Text style={styles.emptyIconText}>↗</Text>
                    </View>
                    <Text style={styles.emptyTitle}>
                        {search ? 'No matches found' : 'No conversations yet'}
                    </Text>
                    <Text style={styles.emptyDescription}>
                        {search
                            ? 'Try another name or clear your search.'
                            : 'Start a conversation and it will show up here.'}
                    </Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 26,
        paddingBottom: 36,
    },
    intro: {
        flex: 1,
        marginBottom: 24,
    },
    heroRow: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    newChatButton: {
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderRadius: 16,
        height: 48,
        justifyContent: 'center',
        marginBottom: 24,
        marginLeft: 12,
        width: 48,
    },
    newChatIcon: {
        color: colors.surface,
        fontSize: 28,
        fontWeight: '300',
        lineHeight: 32,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    title: {
        color: colors.ink,
        fontSize: 30,
        fontWeight: '700',
        letterSpacing: -0.8,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 15,
        marginTop: 6,
    },
    searchBox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        height: 54,
        paddingHorizontal: 15,
        marginBottom: 28,
    },
    searchMark: {
        color: colors.muted,
        fontSize: 25,
        marginRight: 10,
        marginTop: -4,
    },
    searchInput: {
        color: colors.ink,
        flex: 1,
        fontSize: 15,
        height: '100%',
    },
    sectionHeading: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 12,
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 17,
        fontWeight: '700',
    },
    count: {
        backgroundColor: colors.accentSoft,
        borderRadius: 10,
        color: colors.accent,
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 9,
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    list: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    conversation: {
        alignItems: 'center',
        flexDirection: 'row',
        minHeight: 82,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    avatar: {
        alignItems: 'center',
        backgroundColor: colors.accentSoft,
        borderRadius: 22,
        height: 46,
        justifyContent: 'center',
        marginRight: 13,
        width: 46,
    },
    avatarText: {
        color: colors.accent,
        fontSize: 15,
        fontWeight: '700',
    },
    conversationDetails: {
        borderBottomColor: colors.line,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flex: 1,
        justifyContent: 'center',
        minHeight: 58,
    },
    conversationName: {
        color: colors.ink,
        fontSize: 15,
        fontWeight: '600',
    },
    lastMessage: {
        color: colors.muted,
        fontSize: 13,
        marginTop: 5,
    },
    chevron: {
        color: '#A7B0B9',
        fontSize: 27,
        marginLeft: 10,
        marginTop: -3,
    },
    stateCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 18,
        borderWidth: 1,
        gap: 12,
        padding: 24,
    },
    stateText: {
        color: colors.muted,
        fontSize: 14,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 26,
        paddingVertical: 42,
    },
    emptyIcon: {
        alignItems: 'center',
        backgroundColor: colors.accentSoft,
        borderRadius: 28,
        height: 56,
        justifyContent: 'center',
        marginBottom: 16,
        width: 56,
    },
    emptyIconText: {
        color: colors.accent,
        fontSize: 26,
        fontWeight: '600',
    },
    emptyTitle: {
        color: colors.ink,
        fontSize: 17,
        fontWeight: '700',
    },
    emptyDescription: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 7,
        textAlign: 'center',
    },
});

export default ConversationScreen;
