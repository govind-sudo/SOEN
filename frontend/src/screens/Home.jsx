import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {
    const { user, logout } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [modalError, setModalError] = useState('')

    const navigate = useNavigate()

    const fetchProjects = () => {
        axios.get('/projects/all')
            .then((res) => {
                setProjects(res.data.projects || [])
            })
            .catch((err) => {
                console.error(err)
            })
            .finally(() => {
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchProjects()
    }, [])

    function createProject(e) {
        e.preventDefault()
        setModalError('')

        const trimmedName = projectName.trim()
        if (!trimmedName) return

        // Client-side duplicate check (case-insensitive)
        const isDuplicate = projects.some(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
        )

        if (isDuplicate) {
            setModalError('A project with this name already exists.')
            return
        }

        setCreating(true)
        axios.post('/projects/create', { name: trimmedName })
            .then((res) => {
                setProjectName('')
                setModalError('')
                setIsModalOpen(false)
                fetchProjects()
            })
            .catch((error) => {
    console.error('CREATE PROJECT ERROR:', error)
    console.error('RESPONSE:', error.response?.data)

    setModalError(
        error.response?.data?.message ||
        error.message ||
        'Failed to create project.'
    )
})
            .finally(() => {
                setCreating(false)
            })
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setProjectName('')
        setModalError('')
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 selection:bg-indigo-500 selection:text-white">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Top Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                            Projects
                        </h1>
                        <div className="text-sm text-slate-400 mt-1 flex items-center gap-3">
                            <span>{user?.email ? `Logged in as ${user.email}` : 'Manage and collaborate on your workspaces'}</span>
                            {user && (
                                <button
                                    onClick={handleLogout}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-900/60 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 rounded-lg transition"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition duration-150"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        New Project
                    </button>
                </div>

                {/* Projects Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-5 space-y-4">
                                <div className="h-6 w-3/4 bg-slate-800 rounded-md" />
                                <div className="h-4 w-1/2 bg-slate-800/60 rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {/* Create Project Tile */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="group flex flex-col items-center justify-center h-44 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900/40 p-6 transition duration-200 text-center cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-indigo-600/10 border border-slate-800 group-hover:border-indigo-500/30 text-slate-400 group-hover:text-indigo-400 flex items-center justify-center mb-3 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition">
                                Create New Project
                            </span>
                            <span className="text-xs text-slate-500 mt-1">Start collaborating</span>
                        </button>

                        {/* Existing Projects */}
                        {projects.map((proj) => (
                            <div
                                key={proj._id}
                                onClick={() => navigate('/project', { state: { project: proj } })}
                                className="group relative flex flex-col justify-between h-44 p-5 bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl cursor-pointer shadow-lg shadow-black/20 hover:shadow-indigo-500/5 transition duration-200"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                            Active
                                        </span>
                                    </div>
                                    <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition truncate">
                                        {proj.name}
                                    </h2>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span>{proj.users?.length || 0} Collaborators</span>
                                    </div>

                                    <span className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition">
                                        &rarr;
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-white">Create New Project</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Give your project workspace a name</p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Error Notice */}
                        {modalError && (
                            <div className="mb-4 flex items-center gap-2 p-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-xl">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{modalError}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={createProject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                                    Project Name
                                </label>
                                <input
                                    autoFocus
                                    required
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => {
                                        setProjectName(e.target.value)
                                        if (modalError) setModalError('')
                                    }}
                                    placeholder="e.g. Real-Time Chat App"
                                    className={`w-full px-4 py-2.5 bg-slate-950 border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition duration-150 ${
                                        modalError
                                            ? 'border-rose-500/60 focus:ring-rose-500/40 focus:border-rose-500'
                                            : 'border-slate-700/80 focus:ring-indigo-500/50 focus:border-indigo-500'
                                    }`}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating || !projectName.trim()}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition"
                                >
                                    {creating ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Project'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Home