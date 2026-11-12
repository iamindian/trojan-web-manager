import axios from "axios";
import {useNavigate} from "react-router-dom";
const prefix = import.meta.env.VITE_API_PREFIX;
export async function signin(username, password){
    return await axios.get(`${prefix}/signin`,{
        params:{
            username,
            password
        }
    })
}
export async function getExpiration(username){
    return await axios.get(`${prefix}/expiration`,{
        params:{
            username
        }
    })
}
export async function extend(username, password,quantity){
    return await axios.put(`${prefix}/extend`,{
            username,
            password,
            quantity
    })
}
export async function extendById(id,quantity){
    return await axios.put(`${prefix}/extendById`,{
            id,
            quantity
    })
}
export async function addUser(username, password){
    return await axios.post(`${prefix}/adduser`, {
            username,
            password
    })
}