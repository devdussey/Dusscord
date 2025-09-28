// Dashboard JavaScript - Enhanced Interactions and Data Management

class DashboardManager {
    constructor() {
        this.currentView = 'overview';
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupButtons();
        this.setupMobileMenu();
        this.startDataRefresh();
        this.addKeyboardShortcuts();
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                this.switchView(target);
                
                // Update active state
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                link.closest('.nav-item').classList.add('active');
            });

            // Add hover sound effect simulation
            link.addEventListener('mouseenter', () => {
                this.addRippleEffect(link);
            });
        });
    }

    setupButtons() {
        const refreshBtn = document.querySelector('.btn-secondary');
        const deployBtn = document.querySelector('.btn-primary');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        if (deployBtn) {
            deployBtn.addEventListener('click', () => {
                this.deployCommands();
            });
        }

        // Setup feature card buttons
        document.querySelectorAll('.feature-card .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleFeatureAction(btn);
            });
        });

        // Setup stat card clicks
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showStatDetails(card);
            });
        });
    }

    setupMobileMenu() {
        // Add mobile menu toggle if needed
        if (window.innerWidth <= 768) {
            this.createMobileMenuToggle();
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768 && !document.querySelector('.mobile-menu-toggle')) {
                this.createMobileMenuToggle();
            } else if (window.innerWidth > 768) {
                const toggle = document.querySelector('.mobile-menu-toggle');
                if (toggle) toggle.remove();
            }
        });
    }

    createMobileMenuToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle btn btn-secondary';
        toggle.innerHTML = '☰ Menu';
        toggle.style.position = 'fixed';
        toggle.style.top = '1rem';
        toggle.style.left = '1rem';
        toggle.style.zIndex = '1001';
        
        toggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });
        
        document.body.appendChild(toggle);
    }

    addRippleEffect(element) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(229, 62, 62, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.left = '50%';
        ripple.style.top = '50%';
        ripple.style.width = '20px';
        ripple.style.height = '20px';
        ripple.style.marginLeft = '-10px';
        ripple.style.marginTop = '-10px';
        
        element.style.position = 'relative';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    switchView(viewName) {
        this.currentView = viewName;
        
        // Update header title
        const headerTitle = document.querySelector('.dashboard-header h1');
        const titles = {
            overview: 'Dashboard Overview',
            moderation: 'Moderation Center',
            economy: 'Economy Management',
            logging: 'Logging Configuration',
            settings: 'Bot Settings'
        };
        
        if (headerTitle) {
            headerTitle.textContent = titles[viewName] || 'Dashboard';
            this.animateTitle(headerTitle);
        }

        // Simulate view switching with loading state
        this.showLoadingState();
        setTimeout(() => {
            this.hideLoadingState();
            this.updateViewContent(viewName);
        }, 800);
    }

    animateTitle(element) {
        element.style.transform = 'translateY(-10px)';
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.transform = 'translateY(0)';
            element.style.opacity = '1';
        }, 100);
    }

    showLoadingState() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        const mainContent = document.querySelector('.main-content');
        mainContent.classList.add('loading');
    }

    hideLoadingState() {
        this.isLoading = false;
        const mainContent = document.querySelector('.main-content');
        mainContent.classList.remove('loading');
    }

    updateViewContent(viewName) {
        // This would typically fetch and render different content
        // For now, we'll just update some visual indicators
        console.log(`Switched to ${viewName} view`);
        
        // Update stats based on view
        this.updateStatsForView(viewName);
    }

    updateStatsForView(viewName) {
        const statCards = document.querySelectorAll('.stat-card');
        
        // Add subtle animation to indicate data refresh
        statCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 150);
            }, index * 100);
        });
    }

    async refreshData() {
        if (this.isLoading) return;
        
        const refreshBtn = document.querySelector('.btn-secondary');
        const originalText = refreshBtn.textContent;
        
        refreshBtn.textContent = 'Refreshing...';
        refreshBtn.disabled = true;
        this.showLoadingState();
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update random stats to show refresh
        this.updateRandomStats();
        
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
        this.hideLoadingState();
        
        this.showNotification('Data refreshed successfully!', 'success');
    }

    async deployCommands() {
        const deployBtn = document.querySelector('.btn-primary');
        const originalText = deployBtn.textContent;
        
        deployBtn.textContent = 'Deploying...';
        deployBtn.disabled = true;
        
        // Simulate deployment
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        deployBtn.textContent = originalText;
        deployBtn.disabled = false;
        
        this.showNotification('Commands deployed successfully!', 'success');
    }

    updateRandomStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            const current = parseInt(stat.textContent.replace(/,/g, ''));
            const variation = Math.floor(Math.random() * 20) - 10; // -10 to +10
            const newValue = Math.max(0, current + variation);
            
            this.animateNumber(stat, current, newValue);
        });
    }

    animateNumber(element, from, to) {
        const duration = 1000;
        const steps = 30;
        const stepValue = (to - from) / steps;
        let current = from;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            current += stepValue;
            
            if (step >= steps) {
                current = to;
                clearInterval(timer);
            }
            
            element.textContent = Math.floor(current).toLocaleString();
        }, duration / steps);
    }

    handleFeatureAction(button) {
        const action = button.textContent.toLowerCase();
        const featureCard = button.closest('.feature-card');
        const featureName = featureCard.querySelector('h3').textContent;
        
        this.showNotification(`${action} ${featureName}`, 'info');
        
        // Add visual feedback
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
    }

    showStatDetails(card) {
        const statType = card.querySelector('h3').textContent;
        this.showNotification(`Viewing details for ${statType}`, 'info');
        
        // Add visual feedback
        card.style.boxShadow = '0 8px 32px rgba(229, 62, 62, 0.3)';
        setTimeout(() => {
            card.style.boxShadow = '';
        }, 1000);
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '2rem',
            right: '2rem',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '9999',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
        });
        
        // Set background based on type
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #38a169, #2f855a)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #e53e3e, #c53030)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #ff8c00, #e67e22)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #4a5568, #2d3748)';
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 4000);
    }

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R for refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshData();
            }
            
            // Ctrl/Cmd + D for deploy
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.deployCommands();
            }
            
            // Number keys for quick navigation
            if (e.key >= '1' && e.key <= '5') {
                const navItems = document.querySelectorAll('.nav-link');
                const index = parseInt(e.key) - 1;
                if (navItems[index]) {
                    navItems[index].click();
                }
            }
        });
    }

    startDataRefresh() {
        // Auto-refresh data every 30 seconds
        setInterval(() => {
            if (!this.isLoading) {
                this.updateRandomStats();
            }
        }, 30000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new DashboardManager();
    
    // Add CSS animation keyframes dynamically
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .fade-in-up {
            animation: fadeInUp 0.6s ease forwards;
        }
    `;
    document.head.appendChild(style);
    
    // Add fade-in animation to cards
    const cards = document.querySelectorAll('.stat-card, .feature-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.classList.add('fade-in-up');
        }, index * 100);
    });
    
    // Add particle effect to the bot avatar
    const avatar = document.querySelector('.bot-avatar');
    if (avatar) {
        avatar.addEventListener('click', () => {
            dashboard.createParticleEffect(avatar);
        });
    }
    
    // Global error handling
    window.addEventListener('error', (e) => {
        console.error('Dashboard error:', e.error);
        dashboard.showNotification('An error occurred. Please refresh the page.', 'error');
    });
});

// Extend DashboardManager with additional methods
DashboardManager.prototype.createParticleEffect = function(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '4px';
        particle.style.height = '4px';
        particle.style.background = i % 2 === 0 ? '#e53e3e' : '#ffd700';
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        
        const angle = (i / 12) * Math.PI * 2;
        const velocity = 100 + Math.random() * 50;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        document.body.appendChild(particle);
        
        let x = 0, y = 0;
        const animate = () => {
            x += vx * 0.016;
            y += vy * 0.016 + 200 * 0.016; // gravity
            
            particle.style.transform = `translate(${x}px, ${y}px)`;
            particle.style.opacity = Math.max(0, 1 - Math.abs(y) / 200);
            
            if (particle.style.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                particle.remove();
            }
        };
        
        requestAnimationFrame(animate);
    }
};

// Utility functions for dashboard interactions
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'Just now';
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardManager };
}