import axios from 'axios'

const API_URL = import.meta.env.PROD ? '' : ''

export const fetchSongs = async () => {
    try {
        const { data } = await axios.get('/api/songs')
        return data
    } catch (error) {
        console.error('Error fetching songs:', error)
        throw error
    }
}