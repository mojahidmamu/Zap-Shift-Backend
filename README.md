# 🚚 Zap Shift – Backend Server

A simple and scalable backend server for the **Zap Shift** parcel delivery system.
Built with Node.js, Express, and MongoDB to handle parcel management, transactions, and user operations.

---

## 🌐 Live Server

🔗 Coming Soon...

---

## ⚙️ Technologies Used

* Node.js
* Express.js
* MongoDB
* dotenv
* cors

---

## 🚀 Features

* 📦 Parcel data handling (create, update, delete)
* 💰 Transaction system (add money, cost calculation)
* 🔐 Environment variable security with `.env`
* 🌍 CORS enabled for frontend communication
* ⚡ Fast and lightweight Express server

---

## 🛠️ Installation & Setup

### 1️⃣ Clone the repository

```
git clone https://github.com/your-username/zap-shift-backend.git
cd zap-shift-backend
```

### 2️⃣ Install dependencies

```
npm install
```

### 3️⃣ Create `.env` file

Create a `.env` file in the root directory and add:

```
PORT=5000
DB_USER=your_db_user
DB_PASS=your_db_password
```

---

### 4️⃣ Run the server

#### Development mode (with nodemon)

```
npm run dev
```

#### Production mode

```
npm start
```

---

## 🔐 Environment Variables

| Variable | Description         |
| -------- | ------------------- |
| PORT     | Server running port |
| DB_USER  | MongoDB username    |
| DB_PASS  | MongoDB password    |

---

## ❗ Important Notes

* `.env` file is **not pushed to GitHub** for security reasons.
* Use `.env.example` to share required variables.
* Make sure MongoDB connection is properly configured.

---

## 📌 API Endpoint (Basic)

| Method | Endpoint | Description           |
| ------ | -------- | --------------------- |
| GET    | `/`      | Server status message |

---

## 👨‍💻 Author

**Mojahid**
Diploma in Computer Science & Technology (CST)
Aspiring Full Stack Developer 🚀

---

## ⭐ Future Plans

* User authentication (JWT)
* Parcel tracking system
* Payment gateway integration
* Admin dashboard APIs

---

## 💡 Project Goal

Zap Shift aims to provide a smooth and efficient parcel delivery experience with a modern web-based system.

---
