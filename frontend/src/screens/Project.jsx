import React, { useState, useEffect, useContext, useRef, useCallback } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webContainer'
import 'highlight.js/styles/nord.css';

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useContext(UserContext)

    // Panel Resizing Widths & Heights (in px)
    const [leftPanelWidth, setLeftPanelWidth] = useState(360)
    const [explorerWidth, setExplorerWidth] = useState(220)
    const [previewWidth, setPreviewWidth] = useState(440)
    const [terminalHeight, setTerminalHeight] = useState(160)
    const [isDragging, setIsDragging] = useState(false)

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set())
    const [project, setProject] = useState(location.state?.project || {})
    const [message, setMessage] = useState('')
    const messageBox = useRef(null)

    const [users, setUsers] = useState([])
    const [userSearch, setUserSearch] = useState('')
    const [messages, setMessages] = useState([])
    const [fileTree, setFileTree] = useState({})

    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])

    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)
    const [runProcess, setRunProcess] = useState(null)
    const [isRunning, setIsRunning] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState('')

    // 60FPS RAF Smooth Drag Resizing Handler
    const startResize = useCallback((setter, type, isHorizontal = true, isReverse = false) => (e) => {
        e.preventDefault()
        setIsDragging(true)

        const startCoord = isHorizontal ? e.clientX : e.clientY
        let initialDimension = 0

        if (type === 'left') initialDimension = leftPanelWidth
        else if (type === 'explorer') initialDimension = explorerWidth
        else if (type === 'preview') initialDimension = previewWidth
        else if (type === 'terminal') initialDimension = terminalHeight

        let animationFrameId = null

        const onMouseMove = (moveEvent) => {
            const currentCoord = isHorizontal ? moveEvent.clientX : moveEvent.clientY
            const delta = isReverse ? startCoord - currentCoord : currentCoord - startCoord

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId)
            }

            animationFrameId = requestAnimationFrame(() => {
                const nextVal = initialDimension + delta
                if (type === 'left') setter(Math.max(260, Math.min(600, nextVal)))
                else if (type === 'explorer') setter(Math.max(160, Math.min(400, nextVal)))
                else if (type === 'preview') setter(Math.max(280, Math.min(800, nextVal)))
                else if (type === 'terminal') setter(Math.max(80, Math.min(400, nextVal)))
            })
        }

        const onMouseUp = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId)
            }
            setIsDragging(false)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }, [leftPanelWidth, explorerWidth, previewWidth, terminalHeight])

    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const addCollaborators = () => {
        axios.put('/projects/add-user', {
            projectId: project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            setProject(prev => ({
                ...prev,
                users: res.data.project?.users || prev.users
            }))
            setIsModalOpen(false)
        }).catch(err => console.error(err))
    }

    const send = () => {
    if (!message.trim()) return

    sendMessage('project-message', {
        message
    })

    setMessage('')
}

    const closeFile = (e, fileToClose) => {
        e.stopPropagation()
        const filtered = openFiles.filter(f => f !== fileToClose)
        setOpenFiles(filtered)
        if (currentFile === fileToClose) {
            setCurrentFile(filtered.length > 0 ? filtered[filtered.length - 1] : null)
        }
    }

    const WriteAiMessage = (msgContent) => {
        let textContent = msgContent
        try {
            const parsed = JSON.parse(msgContent)
            textContent = parsed.text || msgContent
        } catch {
            // fallback plain text
        }

        return (
            <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed break-words">
                <Markdown
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                >
                    {textContent}
                </Markdown>
            </div>
        )
    }

    useEffect(() => {
        if (!project?._id) return

        initializeSocket(project._id)

        axios.get(`/messages/${project._id}`)
            .then(res => {
                setMessages(res.data)
            })
            .catch(err => {
                console.error('Failed to load messages:', err)
            })

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
            })
        }

        receiveMessage('project-message', data => {
            if ( data.senderType === 'ai' || data.sender?._id === 'ai') {
                try {
                    const parsed = JSON.parse(data.message)
                    if (parsed.fileTree) {
                        webContainer?.mount(parsed.fileTree)
                        setFileTree(parsed.fileTree)
                    }
                } catch (e) {
                    console.error(e)
                }
            }
            setMessages(prev => [...prev, data])
        })

        axios.get(`/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
            const files = Object.keys(res.data.project.fileTree || {})
            if (files.length > 0 && !currentFile) {
                setCurrentFile(files[0])
                setOpenFiles([files[0]])
            }
        })

        axios.get('/users/all').then(res => {
            setUsers(res.data.users || [])
        }).catch(err => console.error(err))
    }, [project?._id])

    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }, [messages])

    const saveFileTree = (ft) => {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).catch(err => console.error(err))
    }

    const runProject = async () => {
        if (!webContainer) return
        setIsRunning(true)
        setTerminalOutput('Mounting files...\n')

        try {
            await webContainer.mount(fileTree)
            setTerminalOutput(prev => prev + 'Running npm install...\n')

            const installProcess = await webContainer.spawn('npm', ['install'])
            installProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    setTerminalOutput(prev => prev + chunk)
                }
            }))

            await installProcess.exit

            if (runProcess) {
                runProcess.kill()
            }

            setTerminalOutput(prev => prev + '\nStarting application...\n')
            const tempRunProcess = await webContainer.spawn('npm', ['start'])
            tempRunProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    setTerminalOutput(prev => prev + chunk)
                }
            }))

            setRunProcess(tempRunProcess)

            webContainer.on('server-ready', (port, url) => {
                setIframeUrl(url)
                setIsRunning(false)
            })
        } catch (err) {
            console.error(err)
            setIsRunning(false)
        }
    }

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    )

    return (
        <main className={`h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden font-sans select-none ${isDragging ? 'cursor-col-resize select-none' : ''}`}>
            {/* 1. LEFT PANEL: Chat / Collaborators */}
            <section
                style={{ width: `${leftPanelWidth}px` }}
                className="relative flex flex-col h-screen bg-slate-900 shrink-0 select-none will-change-[width]"
            >
                {/* Header */}
                <header className="flex items-center justify-between px-4 h-14 bg-slate-900/90 border-b border-slate-800 backdrop-blur shrink-0 z-10">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={() => navigate('/')}
                            title="Back to projects"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h1 className="font-semibold text-sm text-white truncate" title={project?.name}>
                            {project?.name || 'Workspace'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            title="Add collaborator"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-slate-700/60 rounded-lg transition"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Invite
                        </button>
                        <button
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                            title="View collaborators"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Chat Message Box */}
                <div ref={messageBox} className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-8">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 mb-3">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-slate-400">Workspace Chat</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Send prompts to generate code or chat with team members</p>
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        const isAi =
                            msg.senderType === 'ai' ||
                            msg.sender?._id === 'ai'
                        const isSelf = msg.sender?._id === user?._id?.toString()

                        return (
                            <div key={index} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} gap-1.5`}>
                                <div className="flex items-center gap-1.5 px-1">
                                    {isAi ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                                            AI Assistant
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-medium text-slate-400">
                                            {isSelf ? 'You' : msg.sender?.email?.split('@')[0]}
                                        </span>
                                    )}
                                </div>

                                <div
                                    className={`max-w-[90%] rounded-2xl p-3.5 text-sm shadow-md ${
                                        isAi
                                            ? 'bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-sm w-full'
                                            : isSelf
                                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                                            : 'bg-slate-800 border border-slate-700/60 text-slate-200 rounded-tl-sm'
                                    }`}
                                >
                                    {isAi ? WriteAiMessage(msg.message) : <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Input Field */}
                <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            send()
                        }}
                        className="relative flex items-center bg-slate-950 border border-slate-700/80 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30 transition shadow-inner"
                    >
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            type="text"
                            placeholder="Ask AI or chat..."
                            className="w-full pl-3.5 pr-11 py-2.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!message.trim()}
                            className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </form>
                </div>

                {/* Collaborators Overlay */}
                <div
                    className={`absolute inset-0 z-20 bg-slate-900 flex flex-col transition-transform duration-300 ease-in-out ${
                        isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <header className="flex items-center justify-between px-4 h-14 border-b border-slate-800 bg-slate-900">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <h2 className="font-semibold text-sm text-white">Project Members</h2>
                        </div>
                        <button
                            onClick={() => setIsSidePanelOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </header>

                    <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                        {project.users && project.users.map((u, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-semibold flex items-center justify-center text-xs uppercase border border-indigo-500/20">
                                    {u.email?.[0] || 'U'}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-xs font-medium text-slate-200 truncate">{u.email}</p>
                                    <p className="text-[10px] text-slate-500">Collaborator</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* RESIZER 1: Left Panel to Main IDE */}
            <div
                onMouseDown={startResize(setLeftPanelWidth, 'left', true, false)}
                className="w-1 relative cursor-col-resize group flex items-center justify-center z-30 shrink-0 select-none bg-slate-800/60 hover:bg-indigo-500 transition-colors"
            >
                <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>

            {/* 2. RIGHT / CENTER WORKSPACE */}
            <section className="flex-1 flex h-screen bg-slate-950 overflow-hidden min-w-0">
                {/* File Explorer */}
                <div
                    style={{ width: `${explorerWidth}px` }}
                    className="bg-slate-900/60 flex flex-col shrink-0 select-none will-change-[width]"
                >
                    <div className="px-4 h-10 flex items-center justify-between border-b border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Explorer</span>
                        <span className="text-[10px] text-slate-500">{Object.keys(fileTree).length} files</span>
                    </div>

                    <div className="p-2 space-y-1 overflow-y-auto flex-1">
                        {Object.keys(fileTree).length === 0 ? (
                            <p className="text-xs text-slate-500 p-2 italic">No files yet</p>
                        ) : (
                            Object.keys(fileTree).map((file, index) => {
                                const isActive = currentFile === file
                                return (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setCurrentFile(file)
                                            setOpenFiles(prev => Array.from(new Set([...prev, file])))
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono rounded-lg transition text-left cursor-pointer ${
                                            isActive
                                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <span className="truncate">{file}</span>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* RESIZER 2: Explorer to Code Editor */}
                <div
                    onMouseDown={startResize(setExplorerWidth, 'explorer', true, false)}
                    className="w-1 relative cursor-col-resize group flex items-center justify-center z-30 shrink-0 select-none bg-slate-800/60 hover:bg-indigo-500 transition-colors"
                >
                    <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
                </div>

                {/* Code Editor & Terminal Panel */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                    {/* Editor Tab Bar */}
                    <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 shrink-0">
                        <div className="flex items-center gap-2 overflow-x-auto h-full scrollbar-hide">
                            {openFiles.map((file, index) => {
                                const isActive = currentFile === file
                                return (
                                    <div
                                        key={index}
                                        onClick={() => setCurrentFile(file)}
                                        className={`group flex items-center gap-2 h-8 px-3 text-xs font-mono rounded-t-md cursor-pointer border-t-2 transition ${
                                            isActive
                                                ? 'bg-slate-950 text-indigo-300 border-indigo-500'
                                                : 'bg-slate-900 text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-300'
                                        }`}
                                    >
                                        <span>{file}</span>
                                        <button
                                            onClick={(e) => closeFile(e, file)}
                                            className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition p-0.5 rounded"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Top Actions */}
                        <div className="flex items-center gap-2 pl-2">
                            <button
                                onClick={runProject}
                                disabled={isRunning}
                                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm transition"
                            >
                                {isRunning ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        <span>Running</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Run</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Editor Content Area */}
                    <div className="flex-1 flex flex-col min-h-0 relative select-text overflow-hidden">
                        {currentFile && fileTree[currentFile] ? (
                            <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-sm">
                                <pre className="h-full m-0">
                                    <code
                                        className="outline-none block min-h-full text-slate-200"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const updatedContent = e.target.innerText
                                            const ft = {
                                                ...fileTree,
                                                [currentFile]: {
                                                    file: {
                                                        contents: updatedContent
                                                    }
                                                }
                                            }
                                            setFileTree(ft)
                                            saveFileTree(ft)
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlightAuto(fileTree[currentFile]?.file?.contents || '').value
                                        }}
                                        style={{ whiteSpace: 'pre-wrap' }}
                                    />
                                </pre>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 select-none">
                                <svg className="w-12 h-12 mb-3 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                <p className="text-sm">Select a file from the explorer to view or edit</p>
                            </div>
                        )}

                        {/* Terminal Panel with Vertical Resizer */}
                        {terminalOutput && (
                            <>
                                <div
                                    onMouseDown={startResize(setTerminalHeight, 'terminal', false, true)}
                                    className="h-1 relative cursor-row-resize group flex items-center justify-center z-30 shrink-0 select-none bg-slate-800/80 hover:bg-indigo-500 transition-colors"
                                >
                                    <div className="absolute -top-1.5 -bottom-1.5 inset-x-0" />
                                </div>

                                <div
                                    style={{ height: `${terminalHeight}px` }}
                                    className="bg-slate-900 flex flex-col shrink-0 will-change-[height]"
                                >
                                    <div className="h-7 px-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
                                        <span className="text-slate-400 font-mono">Terminal Output</span>
                                        <button
                                            onClick={() => setTerminalOutput('')}
                                            className="hover:text-slate-200"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <pre className="flex-1 p-3 text-xs font-mono text-slate-300 overflow-y-auto whitespace-pre-wrap select-text">
                                        {terminalOutput}
                                    </pre>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 3. LIVE PREVIEW PANEL (With Resizer & Dynamic Iframe Shield) */}
                {iframeUrl && (
                    <>
                        {/* RESIZER 3: Editor to Live Preview */}
                        <div
                            onMouseDown={startResize(setPreviewWidth, 'preview', true, true)}
                            className="w-1 relative cursor-col-resize group flex items-center justify-center z-30 shrink-0 select-none bg-slate-800/60 hover:bg-indigo-500 transition-colors"
                        >
                            <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
                        </div>

                        <div
                            style={{ width: `${previewWidth}px` }}
                            className="bg-slate-900 flex flex-col shrink-0 relative will-change-[width]"
                        >
                            {/* Transparent overlay to stop iframe from intercepting mouse drag events */}
                            {isDragging && <div className="absolute inset-0 z-40 bg-transparent" />}

                            {/* Browser Bar */}
                            <div className="h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2 select-none">
                                <div className="flex-1 flex items-center bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-xs text-slate-400 truncate">
                                    <span className="text-emerald-400 mr-1.5 text-[10px]">🔒</span>
                                    <input
                                        type="text"
                                        value={iframeUrl}
                                        onChange={(e) => setIframeUrl(e.target.value)}
                                        className="bg-transparent outline-none w-full text-slate-300 text-xs font-mono"
                                    />
                                </div>
                                <a
                                    href={iframeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open in new tab"
                                    className="p-1 text-slate-400 hover:text-white rounded transition"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>

                            {/* Live Iframe */}
                            <iframe
                                src={iframeUrl}
                                title="Application Preview"
                                className="w-full flex-1 bg-white border-0"
                            />
                        </div>
                    </>
                )}
            </section>

            {/* Modal: Invite Collaborators */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
                    <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Add Collaborators</h3>
                                <p className="text-xs text-slate-400">Select users to grant workspace access</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="relative mb-3">
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="Search by email..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mb-5">
                            {filteredUsers.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4 text-center">No users found</p>
                            ) : (
                                filteredUsers.map((u) => {
                                    const isSelected = selectedUserId.has(u._id)
                                    return (
                                        <div
                                            key={u._id}
                                            onClick={() => handleUserClick(u._id)}
                                            className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition ${
                                                isSelected
                                                    ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                                                    : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-semibold flex items-center justify-center shrink-0">
                                                    {u.email?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <span className="text-xs truncate">{u.email}</span>
                                            </div>

                                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                                                isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={addCollaborators}
                                disabled={selectedUserId.size === 0}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition"
                            >
                                Add ({selectedUserId.size}) Collaborators
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project