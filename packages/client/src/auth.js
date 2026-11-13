import {signin as login, signout as logout} from "./api/userService";
export default {
    async signin(username, password) {
        const response = await login(username, password) 
        if(response.status===200){
            sessionStorage.setItem("isAuthenticated", 'true');
            this.username = username;
        }
    },
    async signout() {
        await logout();
        sessionStorage.setItem('isAuthenticated', 'false');
        window.dispatchEvent(new Event('storage'));
    },
}