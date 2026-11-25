import Constants from "expo-constants";
import { Platform } from "react-native";

const hostUri = Constants.expoConfig?.hostUri;
const developmentHost = hostUri ? new URL(`http://${hostUri}`).hostname : null;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const reachableDevelopmentHost =
  developmentHost && !loopbackHosts.has(developmentHost)
    ? developmentHost
    : null;

const defaultApiBaseUrl = reachableDevelopmentHost
  ? `http://${reachableDevelopmentHost}:3000`
  : Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  defaultApiBaseUrl;

export const apiUrl = (path) =>
  `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

// export const apiUrl = "http://10.7.27.149:3000";