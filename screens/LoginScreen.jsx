import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const LoginScreen = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const signIn = async () => {
        const accountName = username.trim();
        const accountPassword = password.trim();
        if (!accountName || !accountPassword || loading) {
            setError('Enter both a username and password to continue.');
            return;
        }

        setLoading(true);
        setError('');
        const authorization = `Basic ${accountName}:${accountPassword}`;

        try {
            const response = await fetch(apiUrl('/user/profile'), {
                headers: { Authorization: authorization },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('That username and password could not be verified.');
                }
                throw new Error(`Sign-in failed (${response.status}). Please try again.`);
            }

            const user = await response.json();
            onLogin({ authorization, user });
        } catch (signInError) {
            setError(
                signInError instanceof Error
                    ? signInError.message
                    : 'Could not connect. Check your connection and try again.',
            );
            console.error('Unable to sign in:', signInError);
        } finally {
            setLoading(false);
        }
    };

    const canSignIn = username.trim().length > 0 && password.trim().length > 0 && !loading;

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboard}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.brandMark}>
                        <Text style={styles.brandMarkText}>c</Text>
                    </View>
                    <Text style={styles.eyebrow}>YOUR SPACE TO CONNECT</Text>
                    <Text style={styles.title}>Welcome to chat.</Text>
                    <Text style={styles.subtitle}>
                        Sign in to pick up your conversations, or use a new username to create
                        another account.
                    </Text>

                    <View style={styles.form}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            accessibilityLabel="Username"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="username"
                            placeholder="Your name"
                            placeholderTextColor={colors.muted}
                            value={username}
                            onChangeText={(value) => {
                                setUsername(value);
                                setError('');
                            }}
                            returnKeyType="next"
                            style={styles.input}
                        />

                        <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
                        <TextInput
                            accessibilityLabel="Password"
                            autoCapitalize="none"
                            autoComplete="current-password"
                            placeholder="Your password"
                            placeholderTextColor={colors.muted}
                            secureTextEntry
                            value={password}
                            onChangeText={(value) => {
                                setPassword(value);
                                setError('');
                            }}
                            onSubmitEditing={signIn}
                            returnKeyType="go"
                            style={styles.input}
                        />

                        {error ? (
                            <View accessibilityRole="alert" style={styles.errorBanner}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !canSignIn }}
                            activeOpacity={0.82}
                            disabled={!canSignIn}
                            onPress={signIn}
                            style={[styles.signInButton, !canSignIn && styles.disabledButton]}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.surface} />
                            ) : (
                                <Text style={styles.signInButtonText}>Sign in</Text>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.accountNote}>
                            New usernames create an account on first sign-in.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: colors.background,
        flex: 1,
    },
    keyboard: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 26,
        paddingVertical: 36,
    },
    brandMark: {
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderRadius: 19,
        height: 58,
        justifyContent: 'center',
        marginBottom: 28,
        width: 58,
    },
    brandMarkText: {
        color: colors.surface,
        fontSize: 33,
        fontWeight: '700',
        lineHeight: 40,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.4,
        marginBottom: 9,
    },
    title: {
        color: colors.ink,
        fontSize: 33,
        fontWeight: '700',
        letterSpacing: -1,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 23,
        marginTop: 10,
        maxWidth: 350,
    },
    form: {
        marginTop: 34,
    },
    label: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    passwordLabel: {
        marginTop: 18,
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        color: colors.ink,
        fontSize: 15,
        height: 54,
        paddingHorizontal: 15,
    },
    errorBanner: {
        backgroundColor: '#FFF1F0',
        borderRadius: 12,
        marginTop: 16,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    errorText: {
        color: colors.danger,
        fontSize: 13,
        lineHeight: 18,
    },
    signInButton: {
        alignItems: 'center',
        backgroundColor: colors.accent,
        borderRadius: 15,
        justifyContent: 'center',
        marginTop: 25,
        minHeight: 54,
    },
    disabledButton: {
        backgroundColor: '#A8C6C1',
    },
    signInButtonText: {
        color: colors.surface,
        fontSize: 15,
        fontWeight: '700',
    },
    accountNote: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 18,
        marginTop: 13,
        textAlign: 'center',
    },
});

export default LoginScreen;
