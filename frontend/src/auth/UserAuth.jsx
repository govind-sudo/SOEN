import React, { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user, loading } = useContext(UserContext)

    const token = localStorage.getItem('token')
    const navigate = useNavigate()

    useEffect(() => {

        if (loading) {
            return
        }

        if (!token || !user) {
            navigate('/login')
        }

    }, [loading, user, token, navigate])

    if (loading) {
        return <div>Loading...</div>
    }

    if (!user || !token) {
        return null
    }

    return (
        <>
            {children}
        </>
    )
}

export default UserAuth