import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import turkeyAnimation from '@/assets/lotties/Turkey-Power-Walk.json'

const HomePage = () => {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50/30 overflow-hidden">
      <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* Lottie Animation */}
        <div className="w-64 h-64 mx-auto drop-shadow-2xl">
          <Lottie 
            animationData={turkeyAnimation} 
            loop={true} 
          />
        </div>

        {/* Branding & Info */}
        <div className="space-y-4">
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter">
            VESTIK<span className="text-blue-600">POS</span>
          </h1>
          
          <div className="flex flex-col items-center gap-2">
            <p className="text-5xl font-mono font-medium text-slate-700 tabular-nums">
              {formatTime(time)}
            </p>
            <p className="text-lg text-slate-500 font-medium capitalize">
              {formatDate(time)}
            </p>
          </div>
        </div>

        {/* Minimalist divider */}
        <div className="w-16 h-1 bg-blue-600/20 mx-auto rounded-full" />
        
        <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">
          MCR Logística S.A.C
        </p>
      </div>
    </div>
  )
}

export default HomePage
