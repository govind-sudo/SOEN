import jwt from "jsonwebtoken";
import redisClient from "../services/redis.service.js";

export const authUser = async (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;

        const token =
            req.cookies.token ||
            (authHeader && authHeader.split(' ')[1]);

        console.log("TOKEN EXISTS:", !!token);
        console.log("JWT SECRET EXISTS:", !!process.env.JWT_SECRET);

        if (!token) {
            console.log("NO TOKEN");
            return res.status(401).send({ error: 'Unauthorized User token' });
        }

        const isBlackListed = await redisClient.get(token);

        console.log("BLACKLIST RESULT:", isBlackListed);

        if (isBlackListed) {
            console.log("TOKEN IS BLACKLISTED");

            res.cookie('token', '');

            return res.status(401).send({
                error: 'Unauthorized User balclist'
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        console.log("JWT VERIFIED:", decoded);

        req.user = decoded;

        next();

    } catch (error) {

        console.log("AUTH ERROR:", error.message);

        res.status(401).send({
            error: 'Unauthorized User catch'
        });
    }
};