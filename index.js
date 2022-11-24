const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const colors = require('colors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

// https://meet.google.com/whh-pukb-anw

// doctors-portal
// 65zW7PZ3AcusL9DO

// middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6l0by.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    // console.log('token', req.headers.authorization)
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).send('unauthorize access')
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access1' })
        }
        req.decoded = decoded
        next()
    })
}

async function run() {
    try {
        await client.connect()
        console.log('Db connected'.yellow)

        const appointmentCollections = client.db('doctorsPortal').collection('appointmentOptions')
        const bookingCollections = client.db('doctorsPortal').collection('bookings')
        const usersCollections = client.db('doctorsPortal').collection('users')

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date
            const query = {}
            const options = await appointmentCollections.find(query).toArray()
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingCollections.find(bookingQuery).toArray()
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookSlots.includes(slot))
                option.slots = remainingSlots;
                // console.log('options......', option.slots)
                // console.log('hah', remainingSlots)
            })
            // console.log('date:', date, 'bookingQuery:', bookingQuery, 'alreadyBooked', alreadyBooked, 'options:', options)

            res.send(options)
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            // const query = {}
            // console.log('token', req.headers.authorization)
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access2' })
            }
            const query = { email: email }
            const bookings = await bookingCollections.find(query).toArray()
            res.send(bookings)

        })

        app.post('/booking', async (req, res) => {
            const booking = req.body
            // console.log(booking)
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }
            const alreadyBooked = await bookingCollections.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `you already have a booking in ${booking.appointmentDate}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingCollections.insertOne(booking)
            res.send(result)
        })

        // 

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            // console.log(user)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '12h' });
                return res.send({ accessToken: token })
            }

            res.status(403).send({ accessToken: '' })
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const result = await usersCollections.find(query).toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user)
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            // console.log(email)
            const query = { email }
            const users = await usersCollections.findOne(query)
            // console.log(result)
            res.send({ isAdmin: users?.role === 'admin' })
        })

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollections.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access ' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc, options)
            res.send(result)

        })

    }
    finally {

    }

}
run().catch()


app.get('/', (req, res) => {
    res.send('DOCTORS PORTAL IS RUNNING')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})