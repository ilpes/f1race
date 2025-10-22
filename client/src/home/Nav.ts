import axios, {AxiosRequestConfig} from "axios";

const Nav = () => {
    return {
        async race() {
            const tokenResponse = await axios.get('/api/csrf-cookie');
            const raceResponse = await axios.post(
                '/api/races',
                {},
                {headers: {'x-csrf-token': tokenResponse.data.token}} as AxiosRequestConfig
            );

            window.location.href = `races/${raceResponse.data.raceId}`;
        },
    }
};

export default Nav;
