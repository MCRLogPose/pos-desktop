import LoginCard from "@/features/auth/components/cards/LoginCard";

export default function Login() {
    return (
        <div className="min-h-screen w-full bg-linear-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[100px]" />
            </div>

            {/* Main Content */}
            <div className="w-full flex justify-center z-10">
                <LoginCard />
            </div>
        </div>
    );
}
