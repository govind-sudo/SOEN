import jwt from "jsonwebtoken";
import redisClient from "../services/redis.service.js";


export const authUser = async (req, res, next) => {
    try {

        console.log("AUTH HEADER:", req.headers.authorization);

        const authHeader = req.headers.authorization;

        const token =
            req.cookies?.token ||
            (authHeader && authHeader.startsWith('Bearer ')
                ? authHeader.split(' ')[1]
                : null);

        console.log("TOKEN RECEIVED:", token);

        if (!token) {
            return res.status(401).send({ error: 'Unauthorized User' });
        }

        const isBlackListed = await redisClient.get(token);

        console.log("BLACKLIST:", isBlackListed);

        if (isBlackListed) {
            res.cookie('token', '');
            return res.status(401).send({ error: 'Unauthorized User' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("DECODED:", decoded);

        req.user = decoded;

        next();

    } catch (error) {
        console.log("AUTH ERROR:", error);

        res.status(401).send({ error: 'Unauthorized User' });
    }
};