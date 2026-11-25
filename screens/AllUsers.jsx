import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
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

const AllUsers = () => {
    const { authorization, user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [type, setType] = useState('DM');
    const [search, setSearch] = useState('');
    const [convoName, setConvoName] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const fetchUsers = useCallback(async () => {
        const response = await fetch(apiUrl('/user'), {
            headers: { authorization },
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Unexpected people response');
        return data;
    }, [authorization]);

    useEffect(() => {
        let isMounted = true;
        fetchUsers()
            .then((data) => {
                if (!isMounted) return;
                setUsers(data);
                setError('');
            })
            .catch((loadError) => {
                if (!isMounted) return;
                setError('We couldn’t load people. Check your connection and try again.');
                console.error('Unable to load people:', loadError);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [fetchUsers]);

    const retryLoadUsers = async () => {
        setLoading(true);
        setError('');
        try {
            setUsers(await fetchUsers());
        } catch (loadError) {
            setError('We couldn’t load people. Check your connection and try again.');
            console.error('Unable to load people:', loadError);
        } finally {
            setLoading(false);
        }
    };

    const visibleUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return users.filter(
            (user) =>
                user.id !== currentUser.id &&
                (!query ||
                    `${user.name ?? ''} ${user.bio ?? ''}`.toLowerCase().includes(query)),
        );
    }, [currentUser.id, search, users]);

    const toggleUser = (userId) => {
        setNotice('');
        setSelectedUsers((current) =>
            current.includes(userId)
                ? current.filter((id) => id !== userId)
                : [...current, userId],
        );
    };

    const createConversation = async () => {
        const groupName = convoName.trim();
        if (creating || selectedUsers.length === 0) return;
        if (type === 'GROUP' && !groupName) {
            setError('Add a name for your group first.');
            return;
        }

        setCreating(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch(apiUrl('/conversation'), {
                method: 'POST',
                headers: {
                    Authorization: authorization,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    name: type === 'GROUP' ? groupName : '',
                    participants_ids: selectedUsers,
                }),
            });
            if (!response.ok) throw new Error(`Request failed (${response.status})`);
            await response.json();
            setSelectedUsers([]);
            setConvoName('');
            setNotice('Conversation created. You can find it in Chats.');
        } catch (createError) {
            setError('We couldn’t create the conversation. Please try again.');
            console.error('Unable to create conversation:', createError);
        } finally {
            setCreating(false);
        }
    };

    const renderHeader = () => (
        <View>
            <View style={styles.intro}>
                <Text style={styles.eyebrow}>NEW CONVERSATION</Text>
                <Text style={styles.title}>Find your people</Text>
                <Text style={styles.subtitle}>Choose who you’d like to talk to.</Text>
            </View>

            <View style={styles.typePicker}>
                {[
                    { label: 'Direct message', value: 'DM' },
                    { label: 'Group chat', value: 'GROUP' },
                ].map((option) => {
                    const active = type === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            activeOpacity={0.8}
                            onPress={() => {
                                setType(option.value);
                                setError('');
                                setNotice('');
                            }}
                            style={[styles.typeOption, active && styles.typeOptionActive]}
                        >
                            <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {type === 'GROUP' ? (
                <TextInput
                    accessibilityLabel="Group name"
                    placeholder="Name your group"
                    placeholderTextColor={colors.muted}
                    value={convoName}
                    onChangeText={(value) => {
                        setConvoName(value);
                        setError('');
                    }}
                    style={styles.groupNameInput}
                    maxLength={60}
                    returnKeyType="done"
                />
            ) : null}

            <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                    accessibilityLabel="Search people"
                    placeholder="Search by name"
                    placeholderTextColor={colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchInput}
                    returnKeyType="search"
                />
                {search ? (
                    <TouchableOpacity
                        accessibilityLabel="Clear search"
                        onPress={() => setSearch('')}
                        hitSlop={10}
                    >
                        <Text style={styles.clearSearch}>×</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.listHeading}>
                <Text style={styles.sectionTitle}>People</Text>
                <Text style={styles.selectionCount}>
                    {selectedUsers.length
                        ? `${selectedUsers.length} selected`
                        : `${visibleUsers.length}`}
                </Text>
            </View>

            {notice ? (
                <View style={styles.noticeBanner}>
                    <Text style={styles.noticeText}>{notice}</Text>
                </View>
            ) : null}
            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );

    const renderUser = ({ item }) => {
        const selected = selectedUsers.includes(item.id);
        const initials = (item.name || '?')
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();

        return (
            <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                activeOpacity={0.75}
                onPress={() => toggleUser(item.id)}
                style={[styles.personRow, selected && styles.personRowSelected]}
            >
                <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                        {initials}
                    </Text>
                </View>
                <View style={styles.personDetails}>
                    <Text style={styles.personName} numberOfLines={1}>
                        {item.name || 'Unnamed person'}
                    </Text>
                    <Text style={styles.personBio} numberOfLines={1}>
                        {item.bio || 'Available to chat'}
                    </Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (loading) {
            return (
                <View style={styles.state}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.stateText}>Finding people…</Text>
                </View>
            );
        }

        if (error && users.length === 0) {
            return (
                <View style={styles.state}>
                    <Text style={styles.stateText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={retryLoadUsers}
                    >
                        <Text style={styles.retryLabel}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.state}>
                <Text style={styles.emptyTitle}>
                    {search ? 'No people found' : 'No people yet'}
                </Text>
                <Text style={styles.stateText}>
                    {search ? 'Try another name.' : 'There’s nobody to start a conversation with yet.'}
                </Text>
            </View>
        );
    };

    const canCreate =
        selectedUsers.length > 0 &&
        !creating &&
        (type !== 'GROUP' || convoName.trim().length > 0);

    return (
        <View style={styles.screen}>
            <FlatList
                data={loading || error ? [] : visibleUsers}
                renderItem={renderUser}
                keyExtractor={(item, index) => String(item.id ?? index)}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                extraData={selectedUsers}
            />
            <View style={styles.footer}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canCreate }}
                    activeOpacity={0.8}
                    disabled={!canCreate}
                    onPress={createConversation}
                    style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
                >
                    {creating ? (
                        <ActivityIndicator color={colors.surface} />
                    ) : (
                        <Text style={styles.createButtonText}>
                            {selectedUsers.length
                                ? `Start conversation · ${selectedUsers.length}`
                                : 'Select someone to continue'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    listContent: {
        paddingBottom: 16,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    intro: {
        marginBottom: 22,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.4,
        marginBottom: 8,
    },
    title: {
        color: colors.ink,
        fontSize: 29,
        fontWeight: '700',
        letterSpacing: -0.7,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 14,
        marginTop: 6,
    },
    typePicker: {
        backgroundColor: '#E9ECEF',
        borderRadius: 14,
        flexDirection: 'row',
        marginBottom: 14,
        padding: 4,
    },
    typeOption: {
        alignItems: 'center',
        borderRadius: 11,
        flex: 1,
        justifyContent: 'center',
        minHeight: 42,
        paddingHorizontal: 7,
    },
    typeOptionActive: {
        backgroundColor: colors.surface,
        elevation: 1,
        shadowColor: '#17212B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    typeLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '600',
    },
    typeLabelActive: {
        color: colors.ink,
    },
    groupNameInput: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        color: colors.ink,
        fontSize: 14,
        height: 50,
        marginBottom: 12,
        paddingHorizontal: 15,
    },
    searchBox: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        height: 50,
        paddingHorizontal: 14,
    },
    searchIcon: {
        color: colors.muted,
        fontSize: 24,
        marginRight: 9,
        marginTop: -4,
    },
    searchInput: {
        color: colors.ink,
        flex: 1,
        fontSize: 14,
        height: '100%',
    },
    clearSearch: {
        color: colors.muted,
        fontSize: 23,
        paddingHorizontal: 4,
    },
    listHeading: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: 23,
    },
    sectionTitle: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '700',
    },
    selectionCount: {
        color: colors.muted,
        fontSize: 12,
    },
    noticeBanner: {
        backgroundColor: colors.accentSoft,
        borderRadius: 12,
        marginBottom: 10,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    noticeText: {
        color: colors.accent,
        fontSize: 13,
    },
    errorBanner: {
        backgroundColor: '#FFF1F0',
        borderRadius: 12,
        marginBottom: 10,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    errorText: {
        color: colors.danger,
        fontSize: 13,
    },
    personRow: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        marginBottom: 9,
        minHeight: 72,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    personRowSelected: {
        backgroundColor: '#F1F8F6',
        borderColor: '#A8D0C8',
    },
    avatar: {
        alignItems: 'center',
        backgroundColor: '#EEF1F4',
        borderRadius: 22,
        height: 44,
        justifyContent: 'center',
        marginRight: 12,
        width: 44,
    },
    avatarSelected: {
        backgroundColor: colors.accentSoft,
    },
    avatarText: {
        color: '#66727E',
        fontSize: 14,
        fontWeight: '700',
    },
    avatarTextSelected: {
        color: colors.accent,
    },
    personDetails: {
        flex: 1,
    },
    personName: {
        color: colors.ink,
        fontSize: 14,
        fontWeight: '600',
    },
    personBio: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 4,
    },
    checkbox: {
        alignItems: 'center',
        borderColor: '#CDD4DA',
        borderRadius: 11,
        borderWidth: 1.5,
        height: 22,
        justifyContent: 'center',
        marginLeft: 10,
        width: 22,
    },
    checkboxSelected: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    checkmark: {
        color: colors.surface,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 17,
    },
    state: {
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 30,
    },
    stateText: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    emptyTitle: {
        color: colors.ink,
        fontSize: 15,
        fontWeight: '700',
    },
    retryButton: {
        backgroundColor: colors.accentSoft,
        borderRadius: 12,
        marginTop: 3,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    retryLabel: {
        color: colors.accent,
        fontSize: 13,
        fontWeight: '700',
    },
    footer: {
        backgroundColor: colors.surface,
        borderTopColor: colors.line,
        borderTopWidth: 1,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    createButton: {
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderRadius: 15,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 16,
    },
    createButtonDisabled: {
        backgroundColor: '#A8C6C1',
    },
    createButtonText: {
        color: colors.surface,
        fontSize: 14,
        fontWeight: '700',
    },
});

export default AllUsers;
