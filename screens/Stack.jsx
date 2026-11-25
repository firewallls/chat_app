
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../AuthContext';
import ConversationScreen from './ConversationScreen';
import ChatScreen from './ChatScreen';

const Stack = createNativeStackNavigator();

const StackNavigation = () => {
    const { signOut, user } = useAuth();

    return (
        <Stack.Navigator initialRouteName='Conversation' screenOptions={{
            headerBackButtonDisplayMode: 'generic',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: '#17212B',
            headerTitleStyle: { color: '#17212B', fontSize: 17, fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#F6F7F9' },
            headerRight: () => (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Switch user from ${user.name}`}
                    onPress={signOut}
                    hitSlop={10}
                >
                    <Text style={{ color: '#287A70', fontSize: 12, fontWeight: '600' }}>
                        {user.name} · Switch
                    </Text>
                </TouchableOpacity>
            ),
        }}>
            <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Messages' }} />
            <Stack.Screen name='Chat' component={ChatScreen} options={({ route }) => {
                return {
                    headerTitle: route.params.data.name ?? 'Conversation'
                }
            }} />
        </Stack.Navigator>
    );
}

export default StackNavigation;
