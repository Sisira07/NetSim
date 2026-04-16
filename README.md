# 🌐 NetSim — Network Router Simulator

An interactive **Computer Networks simulator** that visualizes how routing algorithms work in real time.

<img width="2560" height="1252" alt="image" src="https://github.com/user-attachments/assets/c533957d-551a-40cf-ad67-bb77e073bd49" />


🔗 **Live Demo:** https://netsim-b6wp.onrender.com

---

## 🚀 Features

### 🧩 Network Design
- ➕ Add routers dynamically  
- 🔗 Connect routers with weighted links  
- ✏️ Edit link costs in real time  
- ❌ Delete or break links (simulate failures)  
- 🔄 Restore failed links  

---

### 🧠 Routing Algorithms

#### 📡 Distance Vector Routing (DVR)
- Step-by-step routing updates  
- Count-to-infinity simulation  
- Options:
  - Split Horizon  
  - Poison Reverse  

#### 🌍 Link State Algorithm (LSA)
- Dijkstra-based shortest path calculation  
- Instant convergence  

---

### 📊 Visualization
- 📍 Interactive canvas for topology  
- 🌈 Color-coded routers  
- 🔴 Broken links (failure simulation)  
- ✨ Glow effects for active paths  
- 📦 Packet animation across routers  

---

### 📑 Routing Tables
- View routing tables for:
  - All routers  
  - Individual routers  
- Displays:
  - Destination  
  - Cost  
  - Next hop  

---

### 🎮 Simulation Controls
- ▶️ Step-by-step execution  
- ⚡ Run until convergence  
- 🔄 Reset simulation  
- 📈 Progress tracking  

---

### 📦 Packet Simulation
- Select source and destination  
- Visualize packet traversal  
- Displays:
  - Path taken  
  - Total cost  

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Canvas API:** For network visualization  
- **Animations:** requestAnimationFrame  
- **Styling:** Custom neon cyberpunk UI  

---

## 📂 Project Structure

```
project/
│── index.html # Main UI structure
│── style.css # Styling (cyberpunk theme)
│── script.js # Core logic (routing + simulation)

```

---

## ⚙️ How to Run

### 🔹 Option 1: Run Locally
1. Download or clone the project  
2. Open `index.html` in your browser  

---

### 🔹 Option 2: Use Live Version 🚀
Just open:
👉 https://netsim-b6wp.onrender.com

---

## 🧪 Example Usage

1. Add routers (R1, R2, R3…)  
2. Connect them with links and costs  
3. Click **Converge**  
4. View routing tables  
5. Break a link → observe **count-to-infinity**  
6. Enable Split Horizon / Poison Reverse  
7. Send a packet between routers  

---

## 🧠 Concepts Demonstrated

- Distance Vector Routing  
- Link State Routing  
- Count-to-Infinity Problem  
- Split Horizon  
- Poison Reverse  
- Shortest Path Algorithms (Dijkstra)  

---

## 🎯 Future Improvements

- 🌐 Backend integration (real-time sync)  
- 📡 Live routing protocol simulation (RIP/OSPF style)  
- 📊 Graph analytics (latency, throughput)  
- 💾 Save/load network topologies  
- 📱 Mobile responsiveness  

---

## 👨‍💻 Authors

- Rishika Thatipamula  
- Sisira Asapu  
- Sri Vaishnavi  
- Vennapureddy Mahathi  
