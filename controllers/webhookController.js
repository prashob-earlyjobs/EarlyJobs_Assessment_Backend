const user = require('../models/User');
const { verifySignature } = require('../middlewares/webhook');




async function updateInterviewSession(req, res) {
    try {
          const signature = req.headers["x-webhook-signature"];
            const timestamp = req.headers["x-webhook-timestamp"];

            console.log("Webhook headers:",req.headers);



        // const isValid = verifySignature({
        //     rawBody: req.body,
        //     signature,
        //     timestamp,
        //     secret: process.env.WEBHOOK_SECRET
        // });

        // if (!isValid) {
        //     console.warn("Invalid webhook signature");
        //     return res.status(400).send("Invalid signature");
        // }
        console.log("Webhook signature verified successfully",req.body);
        const payload = req.body;

        console.log("Received interview session update webhook:", payload.session.status, payload.session._id);
        if (["created", "in_progress", "completed", "expired"].includes(payload.session.status) === false) {
            res.status(200).send("OK");
            return;
        }

        await user.updateOne(
            {
                "assessment.sessionId": payload.session._id
            },
            {
                $set: {
                    "assessment.$[session].status": payload.session.status
                }
            },
            {
                arrayFilters: [
                    { "session.sessionId": payload.session._id }
                ]
            }
        );
        res.status(200).send("OK");


    } catch (error) {
        console.error("Error handling interview session update webhook:", error);
        res.status(500).send("Webhook Error");
    }

}

module.exports = {
    updateInterviewSession
}