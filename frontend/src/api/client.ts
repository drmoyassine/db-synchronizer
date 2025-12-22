import axios from 'axios'

const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    // In local development, default to localhost:8000 if not specified.
    // This allows both direct hits and (optionally) proxying.
    if (import.meta.env.DEV) {
        return 'http://localhost:8000';
    }

    // In production/docker, use relative paths so Nginx can proxy correctly 
    // based on the host header.
    return '';
};

const API_URL = getBaseUrl();

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})
