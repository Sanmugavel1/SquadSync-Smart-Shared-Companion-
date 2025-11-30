const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Express App
const app = express();
const PORT = 3000;
const JWT_SECRET = 'squad-sync-secret-key-2025-devquest'; // Change this in production

// Middleware
app.use(cors()); // Enable CORS for frontend-backend communication
app.use(bodyParser.json({ limit: '50mb' })); // Parse JSON data (50mb for images)
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
fs.ensureDirSync(dataDir);

// Initialize JSON files if they don't exist
const initializeDataFiles = async () => {
  const files = [
    'expenses.json',
    'deadlines.json',
    'tasks.json',
    'memories.json',
    'classwork.json',
    'polls.json',
    'activities.json',
    'notifications.json',
    'users.json'
  ];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeJson(filePath, []);
      console.log(`✅ Created ${file}`);
    }
  }
};

// Helper function to read JSON file
const readJsonFile = async (filename) => {
  const filePath = path.join(dataDir, filename);
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

// Helper function to write JSON file
const writeJsonFile = async (filename, data) => {
  const filePath = path.join(dataDir, filename);
  try {
    await fs.writeJson(filePath, data, { spaces: 2 });
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
};

// ===== AUTHENTICATION MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ===== AUTHENTICATION ROUTES =====

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Read existing users
    const users = await readJsonFile('users.json');

    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: Date.now(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeJsonFile('users.json', users);

    console.log(`✅ New user registered: ${email}`);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ 
      message: 'Account created successfully',
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Read users
    const users = await readJsonFile('users.json');

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User logged in: ${email}`);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const users = await readJsonFile('users.json');
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ===== GROUP ROUTES =====

// Get all groups for a user
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await readJsonFile('groups.json');
    const userGroups = groups.filter(g => 
      g.members.some(m => m.email === req.user.email)
    );
    res.json(userGroups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// Create new group
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const groups = await readJsonFile('groups.json');
    
    // Get current user info
    const users = await readJsonFile('users.json');
    const currentUser = users.find(u => u.id === req.user.id);
    
    const newGroup = {
      id: Date.now(),
      name,
      description: description || '',
      createdBy: req.user.email,
      members: [
        {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: 'admin'
        },
        ...(members || [])
      ],
      createdAt: new Date().toISOString()
    };

    groups.push(newGroup);
    await writeJsonFile('groups.json', groups);
    
    console.log(`✅ New group created: ${name} by ${req.user.email}`);
    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Add member to group
app.post('/api/groups/:id/members', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    const groupId = parseInt(req.params.id);
    
    const groups = await readJsonFile('groups.json');
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groups[groupIndex];
    
    // Check if member already exists
    if (group.members.some(m => m.email === email)) {
      return res.status(400).json({ error: 'Member already in group' });
    }

    // Add new member
    const newMember = {
      id: Date.now(),
      name,
      email,
      role: 'member',
      addedAt: new Date().toISOString()
    };

    group.members.push(newMember);
    await writeJsonFile('groups.json', groups);
    
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member from group
app.delete('/api/groups/:id/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);
    
    const groups = await readJsonFile('groups.json');
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groups[groupIndex];
    group.members = group.members.filter(m => m.id !== memberId);
    
    await writeJsonFile('groups.json', groups);
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update group
app.put('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, description } = req.body;
    
    const groups = await readJsonFile('groups.json');
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }

    groups[groupIndex] = {
      ...groups[groupIndex],
      name: name || groups[groupIndex].name,
      description: description !== undefined ? description : groups[groupIndex].description
    };
    
    await writeJsonFile('groups.json', groups);
    res.json(groups[groupIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group
app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    
    const groups = await readJsonFile('groups.json');
    const filteredGroups = groups.filter(g => g.id !== groupId);
    
    await writeJsonFile('groups.json', filteredGroups);
    res.json({ message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Update all expense/task/poll routes to include groupId filter
// Example for expenses (apply same pattern to tasks, polls, deadlines):
app.get('/api/expenses/:groupId', async (req, res) => {
  const expenses = await readJsonFile('expenses.json');
  const groupExpenses = expenses.filter(e => e.groupId === parseInt(req.params.groupId));
  res.json(groupExpenses);
});

app.post('/api/expenses/:groupId', async (req, res) => {
  const expenses = await readJsonFile('expenses.json');
  const newExpense = {
    id: Date.now(),
    groupId: parseInt(req.params.groupId),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  expenses.unshift(newExpense);
  await writeJsonFile('expenses.json', expenses);
  res.status(201).json(newExpense);
});


// ===== EXPENSE ROUTES =====
app.get('/api/expenses', async (req, res) => {
  const expenses = await readJsonFile('expenses.json');
  res.json(expenses);
});

app.post('/api/expenses', async (req, res) => {
  const expenses = await readJsonFile('expenses.json');
  const newExpense = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  expenses.unshift(newExpense);
  await writeJsonFile('expenses.json', expenses);
  res.status(201).json(newExpense);
});

app.delete('/api/expenses/:id', async (req, res) => {
  const expenses = await readJsonFile('expenses.json');
  const filteredExpenses = expenses.filter(e => e.id !== parseInt(req.params.id));
  await writeJsonFile('expenses.json', filteredExpenses);
  res.json({ message: 'Expense deleted' });
});

// ===== DEADLINE ROUTES =====
app.get('/api/deadlines', async (req, res) => {
  const deadlines = await readJsonFile('deadlines.json');
  res.json(deadlines);
});

app.post('/api/deadlines', async (req, res) => {
  const deadlines = await readJsonFile('deadlines.json');
  const newDeadline = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  deadlines.push(newDeadline);
  deadlines.sort((a, b) => new Date(a.date) - new Date(b.date));
  await writeJsonFile('deadlines.json', deadlines);
  res.status(201).json(newDeadline);
});

app.delete('/api/deadlines/:id', async (req, res) => {
  const deadlines = await readJsonFile('deadlines.json');
  const filteredDeadlines = deadlines.filter(d => d.id !== parseInt(req.params.id));
  await writeJsonFile('deadlines.json', filteredDeadlines);
  res.json({ message: 'Deadline deleted' });
});

// ===== TASK ROUTES =====
app.get('/api/tasks', async (req, res) => {
  const tasks = await readJsonFile('tasks.json');
  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  const tasks = await readJsonFile('tasks.json');
  const newTask = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  tasks.push(newTask);
  await writeJsonFile('tasks.json', tasks);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', async (req, res) => {
  const tasks = await readJsonFile('tasks.json');
  const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (taskIndex !== -1) {
    tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
    await writeJsonFile('tasks.json', tasks);
    res.json(tasks[taskIndex]);
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const tasks = await readJsonFile('tasks.json');
  const filteredTasks = tasks.filter(t => t.id !== parseInt(req.params.id));
  await writeJsonFile('tasks.json', filteredTasks);
  res.json({ message: 'Task deleted' });
});

// ===== MEMORY ROUTES =====
app.get('/api/memories', async (req, res) => {
  const memories = await readJsonFile('memories.json');
  res.json(memories);
});

app.post('/api/memories', async (req, res) => {
  const memories = await readJsonFile('memories.json');
  const newMemory = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  memories.unshift(newMemory);
  await writeJsonFile('memories.json', memories);
  res.status(201).json(newMemory);
});

app.delete('/api/memories/:id', async (req, res) => {
  const memories = await readJsonFile('memories.json');
  const filteredMemories = memories.filter(m => m.id !== parseInt(req.params.id));
  await writeJsonFile('memories.json', filteredMemories);
  res.json({ message: 'Memory deleted' });
});

// ===== CLASSWORK ROUTES =====
app.get('/api/classwork', async (req, res) => {
  const classwork = await readJsonFile('classwork.json');
  res.json(classwork);
});

app.post('/api/classwork', async (req, res) => {
  const classwork = await readJsonFile('classwork.json');
  const newClasswork = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  classwork.unshift(newClasswork);
  await writeJsonFile('classwork.json', classwork);
  res.status(201).json(newClasswork);
});

app.delete('/api/classwork/:id', async (req, res) => {
  const classwork = await readJsonFile('classwork.json');
  const filteredClasswork = classwork.filter(c => c.id !== parseInt(req.params.id));
  await writeJsonFile('classwork.json', filteredClasswork);
  res.json({ message: 'Classwork deleted' });
});

// ===== POLL ROUTES =====
app.get('/api/polls', async (req, res) => {
  const polls = await readJsonFile('polls.json');
  res.json(polls);
});

app.post('/api/polls', async (req, res) => {
  const polls = await readJsonFile('polls.json');
  const newPoll = {
    id: Date.now(),
    ...req.body,
    status: 'active',
    timestamp: new Date().toISOString()
  };
  polls.unshift(newPoll);
  await writeJsonFile('polls.json', polls);
  res.status(201).json(newPoll);
});

app.put('/api/polls/:id', async (req, res) => {
  const polls = await readJsonFile('polls.json');
  const pollIndex = polls.findIndex(p => p.id === parseInt(req.params.id));
  if (pollIndex !== -1) {
    polls[pollIndex] = { ...polls[pollIndex], ...req.body };
    await writeJsonFile('polls.json', polls);
    res.json(polls[pollIndex]);
  } else {
    res.status(404).json({ error: 'Poll not found' });
  }
});

app.delete('/api/polls/:id', async (req, res) => {
  const polls = await readJsonFile('polls.json');
  const filteredPolls = polls.filter(p => p.id !== parseInt(req.params.id));
  await writeJsonFile('polls.json', filteredPolls);
  res.json({ message: 'Poll deleted' });
});

// ===== ACTIVITY ROUTES =====
app.get('/api/activities', async (req, res) => {
  const activities = await readJsonFile('activities.json');
  res.json(activities.slice(0, 50)); // Return last 50 activities
});

app.post('/api/activities', async (req, res) => {
  const activities = await readJsonFile('activities.json');
  const newActivity = {
    id: Date.now(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  activities.unshift(newActivity);
  await writeJsonFile('activities.json', activities.slice(0, 100)); // Keep only 100
  res.status(201).json(newActivity);
});

// ===== NOTIFICATION ROUTES =====
app.get('/api/notifications', async (req, res) => {
  const notifications = await readJsonFile('notifications.json');
  res.json(notifications);
});

app.post('/api/notifications', async (req, res) => {
  const notifications = await readJsonFile('notifications.json');
  const newNotification = {
    id: Date.now(),
    ...req.body,
    read: false,
    timestamp: new Date().toISOString()
  };
  notifications.unshift(newNotification);
  await writeJsonFile('notifications.json', notifications.slice(0, 100));
  res.status(201).json(newNotification);
});

app.put('/api/notifications/:id/read', async (req, res) => {
  const notifications = await readJsonFile('notifications.json');
  const notifIndex = notifications.findIndex(n => n.id === parseInt(req.params.id));
  if (notifIndex !== -1) {
    notifications[notifIndex].read = true;
    await writeJsonFile('notifications.json', notifications);
    res.json(notifications[notifIndex]);
  } else {
    res.status(404).json({ error: 'Notification not found' });
  }
});

// ===== BACKUP ROUTE =====
app.get('/api/backup', async (req, res) => {
  const allData = {
    expenses: await readJsonFile('expenses.json'),
    deadlines: await readJsonFile('deadlines.json'),
    tasks: await readJsonFile('tasks.json'),
    memories: await readJsonFile('memories.json'),
    classwork: await readJsonFile('classwork.json'),
    polls: await readJsonFile('polls.json'),
    activities: await readJsonFile('activities.json'),
    notifications: await readJsonFile('notifications.json')
  };
  res.json(allData);
});

// Root route - redirect to login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Start server
const startServer = async () => {
  await initializeDataFiles();
  app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║   🚀 SquadSync Backend Server Running     ║
    ║                                            ║
    ║   📡 Server: http://localhost:${PORT}       ║
    ║   📂 Data stored in: backend/data/         ║
    ║   🔐 Authentication: Enabled               ║
    ║                                            ║
    ║   ✅ Ready to accept requests!             ║
    ╚════════════════════════════════════════════╝
    `);
  });
};

startServer();
