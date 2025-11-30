// ===== AUTHENTICATION CHECK =====
function checkAuth() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (!user || !token) {
    window.location.href = 'login.html';
    return false;
  }
  
  // Display user info
  const userData = JSON.parse(user);
  displayUserInfo(userData);
  return true;
}

function displayUserInfo(user) {
  // Add user profile to navbar
  const navMenu = document.getElementById('navMenu');
  const userProfile = document.createElement('li');
  userProfile.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--gradient-primary); border-radius: 25px; color: white;">
      <div style="width: 35px; height: 35px; border-radius: 50%; background: white; color: #667eea; display: flex; align-items: center; justify-content: center; font-weight: 700;">
        ${user.name.charAt(0).toUpperCase()}
      </div>
      <span style="font-weight: 600;">${user.name}</span>
      <button onclick="logout()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 15px; cursor: pointer; margin-left: 10px;">
        <i class="fas fa-sign-out-alt"></i>
      </button>
    </div>
  `;
  navMenu.appendChild(userProfile);
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

// Check authentication on page load
if (!checkAuth()) {
  // Will redirect to login if not authenticated
}


// ===== STATE MANAGEMENT =====
// ===== API CONFIGURATION =====
const API_BASE_URL = 'http://localhost:3000/api';

// API Helper Functions
const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return response.json();
  },
  
  post: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  put: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  delete: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE'
    });
    return response.json();
  }
};

// ===== STATE MANAGEMENT WITH BACKEND =====
class AppState {
    constructor() {
        this.expenses = [];
        this.deadlines = [];
        this.tasks = [];
        this.memories = [];
        this.classwork = [];
        this.polls = [];
        this.groupMembers = ['You', 'Alice', 'Bob', 'Charlie'];
        this.activities = [];
        this.notifications = [];
        this.theme = localStorage.getItem('theme') || 'light';
        
        // Load data from backend
        this.loadAllData();
    }

    // Load all data from backend
    async loadAllData() {
        try {
            this.expenses = await api.get('/expenses');
            this.deadlines = await api.get('/deadlines');
            this.tasks = await api.get('/tasks');
            this.memories = await api.get('/memories');
            this.classwork = await api.get('/classwork');
            this.polls = await api.get('/polls');
            this.activities = await api.get('/activities');
            this.notifications = await api.get('/notifications');
            
            // Render current section after loading
            renderSection(currentSection);
            updateNotificationBadge();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Add expense
    async addExpense(expense) {
        try {
            const newExpense = await api.post('/expenses', expense);
            this.expenses.unshift(newExpense);
            
            await this.addActivity({
                type: 'expense',
                message: `${expense.paidBy} paid ₹${expense.amount} for ${expense.description}`,
                icon: 'fa-wallet',
                color: 'var(--color-bg-1)'
            });
            
            await this.addNotification({
                type: 'expense',
                message: `New expense added: ${expense.description}`,
                icon: 'fa-wallet',
                color: 'var(--color-bg-1)'
            });
        } catch (error) {
            console.error('Error adding expense:', error);
        }
    }

    // Delete expense
    async deleteExpense(id) {
        try {
            await api.delete(`/expenses/${id}`);
            this.expenses = this.expenses.filter(e => e.id !== id);
            
            await this.addActivity({
                type: 'expense',
                message: 'An expense was deleted',
                icon: 'fa-trash',
                color: 'var(--color-bg-4)'
            });
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }

    // Add deadline
    async addDeadline(deadline) {
        try {
            const newDeadline = await api.post('/deadlines', deadline);
            this.deadlines.push(newDeadline);
            this.deadlines.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            await this.addActivity({
                type: 'deadline',
                message: `New deadline: ${deadline.title} on ${new Date(deadline.date).toLocaleDateString()}`,
                icon: 'fa-calendar-check',
                color: 'var(--color-bg-4)'
            });
            
            await this.addNotification({
                type: 'deadline',
                message: `Deadline added: ${deadline.title}`,
                icon: 'fa-calendar-check',
                color: 'var(--color-bg-4)'
            });
        } catch (error) {
            console.error('Error adding deadline:', error);
        }
    }

    // Delete deadline
    async deleteDeadline(id) {
        try {
            await api.delete(`/deadlines/${id}`);
            this.deadlines = this.deadlines.filter(d => d.id !== id);
        } catch (error) {
            console.error('Error deleting deadline:', error);
        }
    }

    // Add task
    async addTask(task) {
        try {
            const newTask = await api.post('/tasks', task);
            this.tasks.push(newTask);
            
            await this.addActivity({
                type: 'task',
                message: `New task created: ${task.title}`,
                icon: 'fa-tasks',
                color: 'var(--color-bg-3)'
            });
        } catch (error) {
            console.error('Error adding task:', error);
        }
    }

    // Update task status
    async updateTaskStatus(id, newStatus) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (task) {
                task.status = newStatus;
                await api.put(`/tasks/${id}`, { status: newStatus });
                
                if (newStatus === 'completed') {
                    await this.addActivity({
                        type: 'task',
                        message: `Task completed: ${task.title}`,
                        icon: 'fa-check-circle',
                        color: 'var(--color-bg-3)'
                    });
                }
            }
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    // Delete task
    async deleteTask(id) {
        try {
            await api.delete(`/tasks/${id}`);
            this.tasks = this.tasks.filter(t => t.id !== id);
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    // Add memory
    async addMemory(memory) {
        try {
            const newMemory = await api.post('/memories', memory);
            this.memories.unshift(newMemory);
            
            await this.addActivity({
                type: 'memory',
                message: `New memory added: ${memory.caption}`,
                icon: 'fa-camera',
                color: 'var(--color-bg-5)'
            });
        } catch (error) {
            console.error('Error adding memory:', error);
        }
    }

    // Delete memory
    async deleteMemory(id) {
        try {
            await api.delete(`/memories/${id}`);
            this.memories = this.memories.filter(m => m.id !== id);
        } catch (error) {
            console.error('Error deleting memory:', error);
        }
    }

    // Add classwork
    async addClasswork(classwork) {
        try {
            const newClasswork = await api.post('/classwork', classwork);
            this.classwork.unshift(newClasswork);
            
            await this.addActivity({
                type: 'classwork',
                message: `New classwork saved: ${classwork.title}`,
                icon: 'fa-file-alt',
                color: 'var(--color-bg-2)'
            });
        } catch (error) {
            console.error('Error adding classwork:', error);
        }
    }

    // Delete classwork
    async deleteClasswork(id) {
        try {
            await api.delete(`/classwork/${id}`);
            this.classwork = this.classwork.filter(c => c.id !== id);
        } catch (error) {
            console.error('Error deleting classwork:', error);
        }
    }

    // Add poll
    async addPoll(poll) {
        try {
            poll.options = poll.options.map(opt => ({
                text: opt,
                votes: 0,
                voters: []
            }));
            
            const newPoll = await api.post('/polls', poll);
            this.polls.unshift(newPoll);
            
            await this.addActivity({
                type: 'poll',
                message: `New poll created: ${poll.question}`,
                icon: 'fa-poll',
                color: 'var(--color-bg-5)'
            });
            
            await this.addNotification({
                type: 'poll',
                message: `New poll: ${poll.question}`,
                icon: 'fa-poll',
                color: 'var(--color-bg-5)'
            });
        } catch (error) {
            console.error('Error adding poll:', error);
        }
    }

    // Vote poll
    async votePoll(pollId, optionIndex, voter) {
        try {
            const poll = this.polls.find(p => p.id === pollId);
            if (poll && poll.status === 'active') {
                // Remove previous vote
                poll.options.forEach(opt => {
                    const voterIndex = opt.voters.indexOf(voter);
                    if (voterIndex > -1) {
                        opt.voters.splice(voterIndex, 1);
                        opt.votes--;
                    }
                });
                
                // Add new vote
                poll.options[optionIndex].voters.push(voter);
                poll.options[optionIndex].votes++;
                
                await api.put(`/polls/${pollId}`, poll);
            }
        } catch (error) {
            console.error('Error voting poll:', error);
        }
    }

    // Close poll
    async closePoll(pollId) {
        try {
            const poll = this.polls.find(p => p.id === pollId);
            if (poll) {
                poll.status = 'closed';
                await api.put(`/polls/${pollId}`, { status: 'closed' });
                
                await this.addActivity({
                    type: 'poll',
                    message: `Poll closed: ${poll.question}`,
                    icon: 'fa-check-circle',
                    color: 'var(--color-bg-3)'
                });
            }
        } catch (error) {
            console.error('Error closing poll:', error);
        }
    }

    // Delete poll
    async deletePoll(id) {
        try {
            await api.delete(`/polls/${id}`);
            this.polls = this.polls.filter(p => p.id !== id);
        } catch (error) {
            console.error('Error deleting poll:', error);
        }
    }

    // Add activity
    async addActivity(activity) {
        try {
            const newActivity = await api.post('/activities', activity);
            this.activities.unshift(newActivity);
            if (this.activities.length > 50) {
                this.activities = this.activities.slice(0, 50);
            }
        } catch (error) {
            console.error('Error adding activity:', error);
        }
    }

    // Add notification
    async addNotification(notification) {
        try {
            const newNotification = await api.post('/notifications', notification);
            this.notifications.unshift(newNotification);
            updateNotificationBadge();
        } catch (error) {
            console.error('Error adding notification:', error);
        }
    }

    // Mark notification as read
    async markNotificationRead(id) {
        try {
            await api.put(`/notifications/${id}/read`, {});
            const notification = this.notifications.find(n => n.id === id);
            if (notification) {
                notification.read = true;
            }
        } catch (error) {
            console.error('Error marking notification read:', error);
        }
    }

    getUnreadNotificationCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    // Other methods remain the same (calculateBalances, getTotalExpenses, etc.)
    calculateBalances() {
        const balances = {};
        this.groupMembers.forEach(member => {
            balances[member] = { paid: 0, owed: 0 };
        });

        this.expenses.forEach(expense => {
            const perPerson = expense.amount / expense.splitBetween.length;
            balances[expense.paidBy].paid += expense.amount;
            expense.splitBetween.forEach(member => {
                balances[member].owed += perPerson;
            });
        });

        Object.keys(balances).forEach(member => {
            balances[member].net = balances[member].paid - balances[member].owed;
        });

        return balances;
    }

    getTotalExpenses() {
        return this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    }

    getUpcomingDeadlines() {
        const now = new Date();
        return this.deadlines.filter(d => new Date(d.date) >= now).length;
    }

    getCompletedTasks() {
        return this.tasks.filter(t => t.status === 'completed').length;
    }
}


// ===== APPLICATION INITIALIZATION =====
const state = new AppState();
let currentSection = 'dashboard';
let draggedTask = null;

// ===== THEME MANAGEMENT =====
function initTheme() {
    const theme = state.theme;
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    state.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// ===== NAVIGATION =====
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            
            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            currentSection = sectionId;
            
            // Close mobile menu
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
            
            // Render section content
            renderSection(sectionId);
        });
    });

    // Mobile menu toggle
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
}

function renderSection(sectionId) {
    switch(sectionId) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'expenses':
            renderExpenses();
            break;
        case 'deadlines':
            renderDeadlines();
            break;
        case 'tasks':
            renderTasks();
            initTaskDragDrop();
            break;
        case 'memories':
            renderMemories();
            break;
        case 'polls':
            renderPolls();
            break;
    }
}

// ===== DASHBOARD =====
function renderDashboard() {
    // Update stats
    document.getElementById('totalExpenses').textContent = `₹${state.getTotalExpenses().toFixed(2)}`;
    document.getElementById('upcomingDeadlines').textContent = state.getUpcomingDeadlines();
    document.getElementById('completedTasks').textContent = state.getCompletedTasks();
    document.getElementById('totalMemories').textContent = state.memories.length;

    // Render activity feed
    const activityFeed = document.getElementById('activityFeed');
    if (state.activities.length === 0) {
        activityFeed.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No recent activity</p>
            </div>
        `;
    } else {
        activityFeed.innerHTML = state.activities.slice(0, 10).map(activity => `
            <div class="activity-item">
                <div class="activity-icon" style="background: ${activity.color};">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <p>${activity.message}</p>
                    <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }
}

// ===== EXPENSES =====
function renderExpenses() {
    const balances = state.calculateBalances();
    
    // Render balance summary
    const balanceSummary = document.getElementById('balanceSummary');
    balanceSummary.innerHTML = Object.entries(balances).map(([member, balance]) => {
        const isPositive = balance.net >= 0;
        return `
            <div class="balance-card">
                <h3>${member}</h3>
                <div class="balance-amount">₹${Math.abs(balance.net).toFixed(2)}</div>
                <div class="balance-details">
                    <div class="balance-detail">
                        <span>Paid</span>
                        <strong>₹${balance.paid.toFixed(2)}</strong>
                    </div>
                    <div class="balance-detail">
                        <span>${isPositive ? 'Gets Back' : 'Owes'}</span>
                        <strong style="color: ${isPositive ? '#10b981' : '#ef4444'}">
                            ₹${Math.abs(balance.net).toFixed(2)}
                        </strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Render expense list
    const expenseList = document.getElementById('expenseList');
    if (state.expenses.length === 0) {
        expenseList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>No expenses added yet</p>
            </div>
        `;
    } else {
        expenseList.innerHTML = state.expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="expense-icon">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="expense-details">
                        <h4>${expense.description}</h4>
                        <p class="expense-meta">
                            Paid by ${expense.paidBy} • Split between ${expense.splitBetween.join(', ')}
                            <br>
                            <small>${formatDate(expense.timestamp)}</small>
                        </p>
                    </div>
                </div>
                <div class="expense-amount">
                    <strong>₹${expense.amount.toFixed(2)}</strong>
                    <span>₹${(expense.amount / expense.splitBetween.length).toFixed(2)} per person</span>
                </div>
                <div class="expense-actions">
                    <button class="btn btn-sm btn-danger" onclick="deleteExpense(${expense.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

function openAddExpenseModal() {
    const modalContent = `
        <div class="modal-header">
            <h2>Add Expense</h2>
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="expenseForm">
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-control" id="expenseDescription" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input type="number" class="form-control" id="expenseAmount" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Paid By</label>
                    <select class="form-control" id="expensePaidBy" required>
                        ${state.groupMembers.map(member => `<option value="${member}">${member}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Split Between</label>
                    ${state.groupMembers.map(member => `
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="split_${member}" value="${member}" checked>
                            <label for="split_${member}">${member}</label>
                        </div>
                    `).join('')}
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitExpense()">Add Expense</button>
        </div>
    `;
    showModal(modalContent);
}

function submitExpense() {
    const description = document.getElementById('expenseDescription').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const paidBy = document.getElementById('expensePaidBy').value;
    const splitBetween = state.groupMembers.filter(member => 
        document.getElementById(`split_${member}`).checked
    );

    if (description && amount && paidBy && splitBetween.length > 0) {
        state.addExpense({
            description,
            amount,
            paidBy,
            splitBetween
        });
        closeModal();
        renderExpenses();
        renderDashboard();
    }
}

function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        state.deleteExpense(id);
        renderExpenses();
        renderDashboard();
    }
}

function openSettleUpModal() {
    const balances = state.calculateBalances();
    const settlements = calculateSettlements(balances);
    
    const modalContent = `
        <div class="modal-header">
            <h2>Settle Up</h2>
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <h3 style="margin-bottom: 16px;">Suggested Settlements</h3>
            ${settlements.length > 0 ? settlements.map(s => `
                <div class="expense-item" style="margin-bottom: 12px;">
                    <div class="expense-info">
                        <div class="expense-icon" style="background: var(--color-bg-3);">
                            <i class="fas fa-exchange-alt"></i>
                        </div>
                        <div class="expense-details">
                            <h4>${s.from} → ${s.to}</h4>
                            <p class="expense-meta">Payment required</p>
                        </div>
                    </div>
                    <div class="expense-amount">
                        <strong>₹${s.amount.toFixed(2)}</strong>
                    </div>
                </div>
            `).join('') : '<p>All settled up! 🎉</p>'}
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn btn-success" onclick="markAllSettled()">Mark All Settled</button>
        </div>
    `;
    showModal(modalContent);
}

function calculateSettlements(balances) {
    const debts = [];
    const credits = [];
    
    Object.entries(balances).forEach(([member, balance]) => {
        if (balance.net < 0) {
            debts.push({ member, amount: Math.abs(balance.net) });
        } else if (balance.net > 0) {
            credits.push({ member, amount: balance.net });
        }
    });
    
    const settlements = [];
    let i = 0, j = 0;
    
    while (i < debts.length && j < credits.length) {
        const debt = debts[i];
        const credit = credits[j];
        const amount = Math.min(debt.amount, credit.amount);
        
        settlements.push({
            from: debt.member,
            to: credit.member,
            amount
        });
        
        debt.amount -= amount;
        credit.amount -= amount;
        
        if (debt.amount === 0) i++;
        if (credit.amount === 0) j++;
    }
    
    return settlements;
}

function markAllSettled() {
    if (confirm('Mark all expenses as settled? This will clear all expenses.')) {
        state.expenses = [];
        state.saveData('expenses', state.expenses);
        state.addActivity({
            type: 'expense',
            message: 'All expenses settled up',
            icon: 'fa-check-circle',
            color: 'var(--color-bg-3)'
        });
        closeModal();
        renderExpenses();
        renderDashboard();
    }
}

// ===== DEADLINES =====
function renderDeadlines() {
    const filter = document.getElementById('deadlineFilter').value;
    const filteredDeadlines = filter === 'all' 
        ? state.deadlines 
        : state.deadlines.filter(d => d.type === filter);

    const deadlineList = document.getElementById('deadlineList');
    if (filteredDeadlines.length === 0) {
        deadlineList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No deadlines set</p>
            </div>
        `;
    } else {
        deadlineList.innerHTML = filteredDeadlines.map(deadline => {
            const date = new Date(deadline.date);
            const now = new Date();
            const daysUntil = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
            let urgencyClass = '';
            
            if (daysUntil < 0) urgencyClass = 'urgent';
            else if (daysUntil <= 3) urgencyClass = 'urgent';
            else if (daysUntil <= 7) urgencyClass = 'warning';

            return `
                <div class="deadline-item ${urgencyClass}">
                    <div class="deadline-date">
                        <span class="deadline-day">${date.getDate()}</span>
                        <span class="deadline-month">${date.toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <div class="deadline-info">
                        <h4>${deadline.title}</h4>
                        <div>
                            <span class="deadline-type">${deadline.type}</span>
                            <span class="deadline-time">
                                ${daysUntil < 0 ? 'Overdue!' : daysUntil === 0 ? 'Today!' : `${daysUntil} days left`}
                            </span>
                        </div>
                    </div>
                    <div class="deadline-actions">
                        <button class="btn btn-sm btn-danger" onclick="deleteDeadline(${deadline.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function openAddDeadlineModal() {
    const modalContent = `
        <div class="modal-header">
            <h2>Add Deadline</h2>
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="deadlineForm">
                <div class="form-group">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-control" id="deadlineTitle" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-control" id="deadlineType" required>
                        <option value="assignment">Assignment</option>
                        <option value="registration">Registration</option>
                        <option value="exam">Exam</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-control" id="deadlineDate" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description (Optional)</label>
                    <textarea class="form-control" id="deadlineDescription"></textarea>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitDeadline()">Add Deadline</button>
        </div>
    `;
    showModal(modalContent);
}

function submitDeadline() {
    const title = document.getElementById('deadlineTitle').value;
    const type = document.getElementById('deadlineType').value;
    const date = document.getElementById('deadlineDate').value;
    const description = document.getElementById('deadlineDescription').value;

    if (title && type && date) {
        state.addDeadline({
            title,
            type,
            date,
            description
        });
        closeModal();
        renderDeadlines();
        renderDashboard();
    }
}

function deleteDeadline(id) {
    if (confirm('Are you sure you want to delete this deadline?')) {
        state.deleteDeadline(id);
        renderDeadlines();
        renderDashboard();
    }
}

// ===== TASKS =====
function renderTasks() {
    const todoTasks = state.tasks.filter(t => t.status === 'todo');
    const progressTasks = state.tasks.filter(t => t.status === 'progress');
    const completedTasks = state.tasks.filter(t => t.status === 'completed');

    document.getElementById('todoCount').textContent = todoTasks.length;
    document.getElementById('progressCount').textContent = progressTasks.length;
    document.getElementById('completedCount').textContent = completedTasks.length;

    renderTaskList('todoTasks', todoTasks);
    renderTaskList('progressTasks', progressTasks);
    renderTaskList('completedTasks', completedTasks);
}

function renderTaskList(containerId, tasks) {
    const container = document.getElementById(containerId);
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state-small">No tasks</div>';
    } else {
        container.innerHTML = tasks.map(task => {
            // Calculate deadline status
            let deadlineHTML = '';
            if (task.deadline) {
                const deadlineDate = new Date(task.deadline);
                const now = new Date();
                const daysUntil = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
                const isOverdue = daysUntil < 0;
                const deadlineClass = isOverdue ? 'overdue' : '';
                const deadlineText = isOverdue 
                    ? `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''}`
                    : daysUntil === 0 
                        ? 'Due today' 
                        : `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
                
                deadlineHTML = `
                    <div class="task-deadline ${deadlineClass}">
                        <i class="fas fa-clock"></i>
                        <span>${deadlineText}</span>
                    </div>
                `;
            }

            return `
                <div class="task-card" draggable="true" data-task-id="${task.id}">
                    <div class="task-header">
                        <h4 class="task-title">${task.title}</h4>
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                    </div>
                    ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                    ${deadlineHTML}
                    <div class="task-footer">
                        <div class="task-assignees">
                            ${task.assignedTo ? task.assignedTo.split('').slice(0, 2).map(char => `
                                <div class="task-assignee">${char.toUpperCase()}</div>
                            `).join('') : ''}
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="deleteTask(${task.id}); event.stopPropagation();">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function openAddTaskModal() {
    const modalContent = `
        <div class="modal-header">
            <h2>Add Task</h2>
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="taskForm">
                <div class="form-group">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-control" id="taskTitle" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description (Optional)</label>
                    <textarea class="form-control" id="taskDescription"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select class="form-control" id="taskPriority" required>
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Deadline (Optional)</label>
                    <input type="date" class="form-control" id="taskDeadline">
                </div>
                <div class="form-group">
                    <label class="form-label">Assigned To</label>
                    <select class="form-control" id="taskAssignedTo">
                        <option value="">Select member</option>
                        ${state.groupMembers.map(member => `<option value="${member}">${member}</option>`).join('')}
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitTask()">Add Task</button>
        </div>
    `;
    showModal(modalContent);
}

function submitTask() {
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    const assignedTo = document.getElementById('taskAssignedTo').value;

    if (title && priority) {
        state.addTask({
            title,
            description,
            priority,
            deadline: deadline || null,
            assignedTo,
            status: 'todo'
        });
        closeModal();
        renderTasks();
        renderDashboard();
        initTaskDragDrop();
    }
}

function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.deleteTask(id);
        renderTasks();
        renderDashboard();
    }
}

// ===== DRAG AND DROP FOR TASKS (FIXED) =====
function initTaskDragDrop() {
    const taskCards = document.querySelectorAll('.task-card');
    const taskLists = document.querySelectorAll('.task-list');
    
    // Add dragstart event to all task cards
    taskCards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    // Add drop zone events to all task lists
    taskLists.forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('drop', handleDrop);
        list.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedTask = parseInt(e.target.dataset.taskId);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.task-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const list = e.currentTarget;
    list.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.target.classList.contains('task-list')) {
        e.target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const list = e.currentTarget;
    list.classList.remove('drag-over');
    
    const newStatus = list.dataset.status;
    
    if (draggedTask && newStatus) {
        state.updateTaskStatus(draggedTask, newStatus);
        renderTasks();
        renderDashboard();
        initTaskDragDrop(); // Re-initialize drag and drop
    }
}

// ===== MEMORIES (WITH LOCAL FILE UPLOAD) =====
let selectedImageFile = null;

function renderMemories() {
    const photoGrid = document.getElementById('photoGrid');
    if (state.memories.length === 0) {
        photoGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-camera"></i>
                <p>No memories added yet</p>
            </div>
        `;
    } else {
        photoGrid.innerHTML = state.memories.map(memory => `
            <div class="memory-card" onclick="viewMemory(${memory.id})">
                <img src="${memory.imageUrl}" alt="${memory.caption}" class="memory-image">
                <div class="memory-content">
                    <h4 class="memory-caption">${memory.caption}</h4>
                    <p class="memory-date">${formatDate(memory.timestamp)}</p>
                </div>
            </div>
        `).join('');
    }

    const classworkList = document.getElementById('classworkList');
    if (state.classwork.length === 0) {
        classworkList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No classwork saved</p>
            </div>
        `;
    } else {
        classworkList.innerHTML = state.classwork.map(work => `
            <div class="classwork-item">
                <div class="classwork-icon">
                    <i class="fas ${getFileIcon(work.type)}"></i>
                </div>
                <div class="classwork-info">
                    <h4>${work.title}</h4>
                    <p class="classwork-meta">
                        ${work.course} • ${work.type} • ${formatDate(work.timestamp)}
                    </p>
                </div>
                <div class="classwork-actions">
                    <button class="btn btn-sm btn-secondary" onclick="downloadClasswork(${work.id})">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteClasswork(${work.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

function openAddMemoryModal() {
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
    if (activeTab === 'photos') {
        const modalContent = `
            <div class="modal-header">
                <h2>Add Memory</h2>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="memoryForm">
                    <div class="form-group">
                        <label class="form-label">Caption</label>
                        <input type="text" class="form-control" id="memoryCaption" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Upload Photo</label>
                        <input type="file" class="file-upload-input" id="memoryImageFile" accept="image/*">
                        <small style="color: var(--color-text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                            Select an image from your computer
                        </small>
                    </div>
                    <div class="image-preview-container" id="imagePreviewContainer" style="display: none;">
                        <img id="imagePreview" class="image-preview" alt="Preview">
                        <button type="button" class="remove-image-btn" onclick="removeImagePreview()">
                            <i class="fas fa-times"></i> Remove Image
                        </button>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date</label>
                        <input type="date" class="form-control" id="memoryDate" required>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitMemory()">Add Memory</button>
            </div>
        `;
        showModal(modalContent);
        
        // Add event listener for file input
        setTimeout(() => {
            const fileInput = document.getElementById('memoryImageFile');
            if (fileInput) {
                fileInput.addEventListener('change', handleImageSelect);
            }
        }, 100);
    } else {
        const modalContent = `
            <div class="modal-header">
                <h2>Add Classwork</h2>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="classworkForm">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="classworkTitle" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Course</label>
                        <input type="text" class="form-control" id="classworkCourse" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Type</label>
                        <select class="form-control" id="classworkType" required>
                            <option value="PDF">PDF</option>
                            <option value="Document">Document</option>
                            <option value="Presentation">Presentation</option>
                            <option value="Notes">Notes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">File URL</label>
                        <input type="url" class="form-control" id="classworkUrl" required>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitClasswork()">Add Classwork</button>
            </div>
        `;
        showModal(modalContent);
    }
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            const previewContainer = document.getElementById('imagePreviewContainer');
            const preview = document.getElementById('imagePreview');
            preview.src = event.target.result;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function removeImagePreview() {
    selectedImageFile = null;
    document.getElementById('memoryImageFile').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
}

function submitMemory() {
    const caption = document.getElementById('memoryCaption').value;
    const date = document.getElementById('memoryDate').value;

    if (caption && date && selectedImageFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            state.addMemory({
                caption,
                imageUrl: event.target.result,
                date
            });
            selectedImageFile = null;
            closeModal();
            renderMemories();
            renderDashboard();
        };
        reader.readAsDataURL(selectedImageFile);
    } else {
        alert('Please fill all fields and select an image');
    }
}

function submitClasswork() {
    const title = document.getElementById('classworkTitle').value;
    const course = document.getElementById('classworkCourse').value;
    const type = document.getElementById('classworkType').value;
    const url = document.getElementById('classworkUrl').value;

    if (title && course && type && url) {
        state.addClasswork({
            title,
            course,
            type,
            url
        });
        closeModal();
        renderMemories();
        renderDashboard();
    }
}

function viewMemory(id) {
    const memory = state.memories.find(m => m.id === id);
    if (memory) {
        const modalContent = `
            <div class="modal-header">
                <h2>${memory.caption}</h2>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <img src="${memory.imageUrl}" alt="${memory.caption}" style="width: 100%; border-radius: 8px; margin-bottom: 16px;">
                <p style="color: var(--color-text-secondary);">${formatDate(memory.timestamp)}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="deleteMemory(${memory.id}); closeModal();">Delete</button>
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        `;
        showModal(modalContent);
    }
}

function deleteMemory(id) {
    if (confirm('Are you sure you want to delete this memory?')) {
        state.deleteMemory(id);
        renderMemories();
        renderDashboard();
    }
}

function deleteClasswork(id) {
    if (confirm('Are you sure you want to delete this classwork?')) {
        state.deleteClasswork(id);
        renderMemories();
        renderDashboard();
    }
}

function downloadClasswork(id) {
    const work = state.classwork.find(c => c.id === id);
    if (work) {
        window.open(work.url, '_blank');
    }
}

function getFileIcon(type) {
    const icons = {
        'PDF': 'fa-file-pdf',
        'Document': 'fa-file-word',
        'Presentation': 'fa-file-powerpoint',
        'Notes': 'fa-sticky-note'
    };
    return icons[type] || 'fa-file';
}

// ===== POLLS =====
function renderPolls() {
    const filter = document.getElementById('pollFilter').value;
    const filteredPolls = filter === 'all' 
        ? state.polls 
        : state.polls.filter(p => p.status === filter);

    const pollList = document.getElementById('pollList');
    if (filteredPolls.length === 0) {
        pollList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-vote-yea"></i>
                <p>No polls created yet</p>
            </div>
        `;
    } else {
        pollList.innerHTML = filteredPolls.map(poll => {
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
            const userVoted = poll.options.some(opt => opt.voters.includes('You'));

            return `
                <div class="poll-card">
                    <div class="poll-header">
                        <div>
                            <h3 class="poll-title">${poll.question}</h3>
                            <p class="poll-meta">Created ${formatTimeAgo(poll.timestamp)}</p>
                        </div>
                        <span class="poll-status ${poll.status}">${poll.status}</span>
                    </div>
                    <div class="poll-options">
                        ${poll.options.map((option, index) => {
                            const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
                            const voted = option.voters.includes('You');
                            return `
                                <div class="poll-option ${voted ? 'voted' : ''}" 
                                     onclick="votePoll(${poll.id}, ${index})"
                                     style="${poll.status === 'closed' ? 'cursor: not-allowed;' : ''}">
                                    <div class="poll-option-text">
                                        <span class="poll-option-label">
                                            ${voted ? '✓ ' : ''}${option.text}
                                        </span>
                                        <span class="poll-option-votes">${option.votes} votes (${percentage}%)</span>
                                    </div>
                                    <div class="poll-option-bar">
                                        <div class="poll-option-fill" style="width: ${percentage}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="poll-footer">
                        <span class="poll-total">${totalVotes} total votes</span>
                        <div style="display: flex; gap: 8px;">
                            ${poll.status === 'active' ? `
                                <button class="btn btn-sm btn-secondary" onclick="closePoll(${poll.id})">
                                    <i class="fas fa-lock"></i> Close Poll
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="deletePoll(${poll.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function openAddPollModal() {
    const modalContent = `
        <div class="modal-header">
            <h2>Create Poll</h2>
            <button class="modal-close" onclick="closeModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="pollForm">
                <div class="form-group">
                    <label class="form-label">Question</label>
                    <input type="text" class="form-control" id="pollQuestion" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Options</label>
                    <input type="text" class="form-control" id="pollOption1" placeholder="Option 1" required style="margin-bottom: 8px;">
                    <input type="text" class="form-control" id="pollOption2" placeholder="Option 2" required style="margin-bottom: 8px;">
                    <input type="text" class="form-control" id="pollOption3" placeholder="Option 3 (optional)" style="margin-bottom: 8px;">
                    <input type="text" class="form-control" id="pollOption4" placeholder="Option 4 (optional)">
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitPoll()">Create Poll</button>
        </div>
    `;
    showModal(modalContent);
}

function submitPoll() {
    const question = document.getElementById('pollQuestion').value;
    const options = [
        document.getElementById('pollOption1').value,
        document.getElementById('pollOption2').value,
        document.getElementById('pollOption3').value,
        document.getElementById('pollOption4').value
    ].filter(opt => opt.trim() !== '');

    if (question && options.length >= 2) {
        state.addPoll({
            question,
            options
        });
        closeModal();
        renderPolls();
        renderDashboard();
    } else {
        alert('Please provide a question and at least 2 options');
    }
}

function votePoll(pollId, optionIndex) {
    const poll = state.polls.find(p => p.id === pollId);
    if (poll && poll.status === 'active') {
        state.votePoll(pollId, optionIndex, 'You');
        renderPolls();
    }
}

function closePoll(pollId) {
    state.closePoll(pollId);
    renderPolls();
}

function deletePoll(id) {
    if (confirm('Are you sure you want to delete this poll?')) {
        state.deletePoll(id);
        renderPolls();
    }
}

// ===== MODAL SYSTEM =====
function showModal(content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content;
    modal.classList.add('active');
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    selectedImageFile = null;
}

// ===== NOTIFICATIONS =====
function renderNotifications() {
    const notificationList = document.getElementById('notificationList');
    if (state.notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
    } else {
        notificationList.innerHTML = state.notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="markNotificationRead(${notif.id})">
                <div class="notification-icon" style="background: ${notif.color};">
                    <i class="fas ${notif.icon}"></i>
                </div>
                <div class="notification-content">
                    <p>${notif.message}</p>
                    <span class="notification-time">${formatTimeAgo(notif.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }
    updateNotificationBadge();
}

function markNotificationRead(id) {
    state.markNotificationRead(id);
    renderNotifications();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const count = state.getUnreadNotificationCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
}

document.getElementById('showNotifications').addEventListener('click', () => {
    const panel = document.getElementById('notificationPanel');
    panel.classList.add('active');
    renderNotifications();
});

document.getElementById('closeNotifications').addEventListener('click', () => {
    const panel = document.getElementById('notificationPanel');
    panel.classList.remove('active');
});

// ===== FLOATING ACTION BUTTON =====
const fab = document.getElementById('fab');
const fabButton = fab.querySelector('.fab-button');
const fabOptions = fab.querySelectorAll('.fab-option');

fabButton.addEventListener('click', () => {
    fab.classList.toggle('active');
});

fabOptions.forEach(option => {
    option.addEventListener('click', () => {
        const action = option.dataset.action;
        fab.classList.remove('active');
        
        switch(action) {
            case 'expense':
                openAddExpenseModal();
                break;
            case 'deadline':
                openAddDeadlineModal();
                break;
            case 'task':
                openAddTaskModal();
                break;
            case 'memory':
                openAddMemoryModal();
                break;
            case 'poll':
                openAddPollModal();
                break;
        }
    });
});

// Close FAB when clicking outside
document.addEventListener('click', (e) => {
    if (!fab.contains(e.target)) {
        fab.classList.remove('active');
    }
});

// ===== BUTTON EVENT LISTENERS =====
document.getElementById('addExpenseBtn').addEventListener('click', openAddExpenseModal);
document.getElementById('addDeadlineBtn').addEventListener('click', openAddDeadlineModal);
document.getElementById('addTaskBtn').addEventListener('click', openAddTaskModal);
document.getElementById('addMemoryBtn').addEventListener('click', openAddMemoryModal);
document.getElementById('addPollBtn').addEventListener('click', openAddPollModal);
document.getElementById('settleUpBtn').addEventListener('click', openSettleUpModal);

// Filter event listeners
document.getElementById('deadlineFilter').addEventListener('change', renderDeadlines);
document.getElementById('pollFilter').addEventListener('change', renderPolls);

// Tab switching for memories
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName) {
                content.classList.add('active');
            }
        });
    });
});

// ===== UTILITY FUNCTIONS =====
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return formatDate(timestamp);
}

// ===== DEADLINE NOTIFICATIONS =====
function checkDeadlineNotifications() {
    const now = new Date();
    state.deadlines.forEach(deadline => {
        const deadlineDate = new Date(deadline.date);
        const daysUntil = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
        
        // Notify 3 days before, 1 day before, and on the day
        if ([3, 1, 0].includes(daysUntil)) {
            const existingNotif = state.notifications.find(n => 
                n.message.includes(deadline.title) && 
                n.message.includes(daysUntil === 0 ? 'today' : `${daysUntil} day`)
            );
            
            if (!existingNotif) {
                let message = '';
                if (daysUntil === 0) {
                    message = `⚠️ Deadline today: ${deadline.title}`;
                } else {
                    message = `⏰ Deadline in ${daysUntil} day${daysUntil > 1 ? 's' : ''}: ${deadline.title}`;
                }
                
                state.addNotification({
                    type: 'deadline',
                    message: message,
                    icon: 'fa-calendar-exclamation',
                    color: 'var(--color-bg-4)'
                });
            }
        }
    });
    updateNotificationBadge();
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
        closeModal();
        document.getElementById('notificationPanel').classList.remove('active');
        fab.classList.remove('active');
    }
    
    // Ctrl/Cmd + N for new expense
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddExpenseModal();
    }
});

// ===== INITIALIZATION =====
function init() {
    initTheme();
    initNavigation();
    renderDashboard();
    renderNotifications();
    checkDeadlineNotifications();
    
    // Check deadline notifications every hour
    setInterval(checkDeadlineNotifications, 3600000);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
