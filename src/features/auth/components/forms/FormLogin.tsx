import { useState } from "react";
import { useNavigate } from "react-router-dom";
//validara que los usuarios sean correctos por ahora solo username=manuel, password=123456 rediririra a HomePage
const FormLogin = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (username === "manuel" && password === "123456") {
            console.log("Usuario correcto");
            navigate("/home");
        } else {
            console.log("Usuario incorrecto");
        }
        console.log(username, password);
    };
    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
    };
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };
    return (
        <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <input type="text" placeholder="Usuario" className="border border-gray-300 rounded-md p-2" value={username} onChange={handleUsernameChange} />
            <input type="password" placeholder="Contraseña" className="border border-gray-300 rounded-md p-2" value={password} onChange={handlePasswordChange} />
            <button type="submit" className="bg-blue-500 text-white rounded-md p-2">Iniciar Sesión</button>
        </form>
    );
};

export default FormLogin;