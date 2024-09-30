import './style.css';
import axios, {AxiosRequestConfig} from "axios";

const goToRace =  async () => {
    const tokenResponse = await axios.get('/api/csrf-cookie');
    const raceResponse = await axios.post(
        '/api/races',
        {},
        {headers: {'x-csrf-token': tokenResponse.data.token}} as AxiosRequestConfig
    );

    window.location.href = `races/${raceResponse.data.raceId}`;
};

const warmUp = document.querySelector('#warm-up');
warmUp.addEventListener('click', async (event: MouseEvent) => {
    event.preventDefault();
    await goToRace();
})
