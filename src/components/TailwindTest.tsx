
const TailwindTest = () => {
    return (
        <div className="flex flex-col items-center justify-center p-8 m-4 from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300">
            <h2 className="text-4xl font-black text-white mb-4 drop-shadow-md">
                Tailwind v4 working! 🚀
            </h2>
            <div className="flex space-x-4">
                <div className="px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-semibold border border-white/30">
                    Modern
                </div>
                <div className="px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-semibold border border-white/30">
                    Fast
                </div>
                <div className="px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-semibold border border-white/30">
                    Premium
                </div>
            </div>
            <p className="mt-4 text-white/80 text-center max-w-md">
                This component uses gradients, glassmorphism (backdrop-blur), flexbox, and transitions to verify Tailwind CSS v4 is correctly integrated with your Vite + Tauri setup.
            </p>
        </div>
    );
};

export default TailwindTest;
