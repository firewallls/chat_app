import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthContext } from "./AuthContext";
import AllUsers from "./screens/AllUsers";
import StackNavigation from "./screens/Stack";
import ImagePickerScreen from "./screens/ImagePicker";
import CameraScreen from "./screens/CameraScreen";
import RawCameraScreen from "./screens/RawCameraScreen";
import LoginScreen from "./screens/LoginScreen";


const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const signOut = () => setSession(null);

  return (
    <SafeAreaProvider>
      {session ? (
        <AuthContext.Provider value={{ ...session, signOut }}>
          <NavigationContainer>
            <Tab.Navigator
              initialRouteName="Conversations"
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#287A70',
                tabBarInactiveTintColor: '#89939D',
                tabBarLabelStyle: {
                  fontSize: 11,
                  fontWeight: '600',
                  marginBottom: 3,
                },
                tabBarStyle: {
                  backgroundColor: '#FFFFFF',
                  borderTopColor: '#E8EBEF',
                  paddingTop: 7,
                },
              }}
            >
              <Tab.Screen
                name="Conversations"
                component={StackNavigation}
                options={{ tabBarLabel: 'Chats' }}
              />
              <Tab.Screen
                name="AllUsers"
                component={AllUsers}
                options={{ headerShown: true, title: 'People', tabBarLabel: 'People' }}
              />
              <Tab.Screen
                name="ImagePickerScreen"
                component={ImagePickerScreen}
                options={{ headerShown: true, title: 'Gallery', tabBarLabel: 'Gallery' }}
              />
              <Tab.Screen
                name="CameraScreen"
                component={CameraScreen}
                options={{ tabBarLabel: 'Camera' }}
              />
              <Tab.Screen
                name="RawCameraScreen"
                component={RawCameraScreen}
                options={{ tabBarLabel: 'Pro camera' }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </AuthContext.Provider>
      ) : (
        <LoginScreen onLogin={setSession} />
      )}
    </SafeAreaProvider>
  );
}

