
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ==================== AUTH PAGE ====================
const AuthPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', username: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const { data } = await API.post(endpoint, form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>{isLogin ? 'Login' : 'Sign Up'}</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
              <input type="text" name="firstName" placeholder="First Name" value={form.firstName} onChange={handleChange} />
              <input type="text" name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleChange} />
            </>
          )}
          
          <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
          
          <button type="submit" disabled={loading}>{loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}</button>
        </form>
        
        <p>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button className="toggle-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

// ==================== DASHBOARD PAGE ====================
const Dashboard = ({ user, onLogout }) => {
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(user.profile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(profile);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' });
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState({ status: '', priority: '', search: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get('/api/user/profile');
      setProfile(data.profile);
      setProfileForm(data.profile);
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.search) params.append('search', filter.search);
      
      const { data } = await API.get(`/api/tasks?${params}`);
      setTasks(data);
      setError('');
    } catch (err) {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    
    try {
      const { data } = await API.post('/api/tasks', newTask);
      setTasks([data, ...tasks]);
      setNewTask({ title: '', description: '', priority: 'medium' });
    } catch (err) {
      setError('Failed to add task');
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      const { data } = await API.put(`/api/tasks/${id}`, updates);
      setTasks(tasks.map(t => t._id === id ? data : t));
      setEditingTask(null);
    } catch (err) {
      setError('Failed to update task');
    }
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm('Delete this task?')) {
      try {
        await API.delete(`/api/tasks/${id}`);
        setTasks(tasks.filter(t => t._id !== id));
      } catch (err) {
        setError('Failed to delete task');
      }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await API.put('/api/user/profile', profileForm);
      setProfile(profileForm);
      setEditingProfile(false);
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-grid">
        {/* Profile Section */}
        <section className="profile-section card">
          <h2>Profile</h2>
          {editingProfile ? (
            <form onSubmit={handleUpdateProfile}>
              <input
                type="text"
                placeholder="First Name"
                value={profileForm.firstName || ''}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={profileForm.lastName || ''}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
              />
              <textarea
                placeholder="Bio"
                value={profileForm.bio || ''}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              />
              <div className="button-group">
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditingProfile(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <p><strong>{profileForm.firstName} {profileForm.lastName}</strong></p>
              <p>{profileForm.bio}</p>
              <button onClick={() => setEditingProfile(true)}>Edit Profile</button>
            </>
          )}
        </section>

        {/* Tasks Section */}
        <section className="tasks-section">
          <h2>Tasks</h2>

          {/* Add Task Form */}
          <div className="card add-task-card">
            <form onSubmit={handleAddTask}>
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
              <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <button type="submit">Add Task</button>
            </form>
          </div>

          {/* Filters */}
          <div className="filters card">
            <input
              type="text"
              placeholder="Search tasks..."
              value={filter.search}
              onChange={(e) => { setFilter({ ...filter, search: e.target.value }); fetchTasks(); }}
            />
            <select value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); fetchTasks(); }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <select value={filter.priority} onChange={(e) => { setFilter({ ...filter, priority: e.target.value }); fetchTasks(); }}>
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Tasks List */}
          <div className="tasks-list">
            {loading ? (
              <p className="loading">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="empty">No tasks found</p>
            ) : (
              tasks.map(task => (
                <div key={task._id} className={`task-card card priority-${task.priority}`}>
                  {editingTask === task._id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateTask(task._id, newTask); }}>
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      />
                      <textarea
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      />
                      <select value={newTask.status || task.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <div className="button-group">
                        <button type="submit">Save</button>
                        <button type="button" onClick={() => setEditingTask(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3>{task.title}</h3>
                      <p>{task.description}</p>
                      <div className="task-meta">
                        <span className={`status status-${task.status}`}>{task.status}</span>
                        <span className={`priority prio-${task.priority}`}>{task.priority}</span>
                      </div>
                      <div className="button-group">
                        <button onClick={() => { setEditingTask(task._id); setNewTask(task); }}>Edit</button>
                        <button onClick={() => handleDeleteTask(task._id)} className="delete-btn">Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return user ? <Dashboard user={user} onLogout={handleLogout} /> : <AuthPage onLogin={setUser} />;
}
