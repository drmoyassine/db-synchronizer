import axios from 'axios'

const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    // If we're in a browser and the current host is not localhost,
    // but the API_URL points to localhost, force relative paths.
    if (typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        (envUrl?.includes('localhost') || !envUrl)) {
        return '';
    }
    return envUrl || '';
};

const API_URL = getBaseUrl();

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})
