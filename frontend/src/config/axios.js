import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL
});

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    console.log("TOKEN:", token);
    console.log("REQUEST:", config.url);

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    console.log("AUTH HEADER:", config.headers.Authorization);

    return config;
});

export default axiosInstance;