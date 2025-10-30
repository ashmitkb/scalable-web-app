
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ==================== SCHEMAS ====================
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  profile: {
    firstName: String,
    lastName: String,
    bio: String,
    avatar: String
  },
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Task = mongoose.model('Task', TaskSchema);

// ==================== MIDDLEWARE ====================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_change_in_production');
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      profile: { firstName, lastName }
    });
    
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret_key_change_in_production', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: { id: user._id, username, email, profile: user.profile }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret_key_change_in_production', { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user._id, username: user.username, email, profile: user.profile }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== USER ROUTES ====================
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, bio, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profile: { firstName, lastName, bio, avatar } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TASK ROUTES (CRUD) ====================
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    
    const task = new Task({
      userId: req.userId,
      title,
      description,
      priority,
      dueDate
    });
    
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    let query = { userId: req.userId };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) query.title = { $regex: search, $options: 'i' };
    
    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
