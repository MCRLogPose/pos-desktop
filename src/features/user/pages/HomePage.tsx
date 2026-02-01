import { initDB } from '@/services/db/index.ts'
import { seedDatabase } from '@/services/db/seed'
import { useEffect, useState } from 'react'
import { isTauri } from '@/services/db/tauri.ts'

const HomePage = () => {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const start = async () => {
      console.log("Iniciando DB...")

      const tauri = await isTauri()

      if (!tauri) {
        console.warn("Modo navegador: SQLite deshabilitado")
        setReady(true)
        return
      }

      try {
        await initDB()
        await seedDatabase()
        console.log("DB lista con datos iniciales")
        setReady(true)
      } catch (err) {
        console.error("DB error", err)
        setError("Error inicializando DB")
      }
    }

    start()
  }, [])

  if (!ready)
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        Loading...
      </div>
    )

  if (error)
    return (
      <div className="min-h-screen bg-red-600 flex items-center justify-center">
        Error: {error}
      </div>
    )

  return (
      <div className="min-h-screen bg-green-600 flex flex-col gap-2 items-center justify-center">
        <h1 className="text-3xl font-bold text-white">
          POS Desktop listo 🚀
        </h1>
        <p className="text-white">
          SQLite conectada correctamente
        </p>
      </div>
  )
}

export default HomePage
