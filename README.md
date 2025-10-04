# 🚀 Ramble

A modern admin dashboard application with real user authentication.

## 🏗️ Architecture

- **Frontend**: React + Vite (deployed on Railway)
- **Backend**: Node.js + Express API (deployed on Railway)
- **Database**: PostgreSQL (Railway managed)
- **Authentication**: JWT with refresh tokens

## 🔧 Setup

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and JWT secrets
   ```

4. **Run database migrations**:
   ```bash
   npm run migrate
   ```
   This creates the database tables and a default admin user:
   - **Email**: `admin@rambley.com`
   - **Password**: `AdminPass123!`
   - ⚠️ **Change this password after first login!**

5. **Start the backend server**:
   ```bash
   npm run dev  # Development
   npm start    # Production
   ```

### Frontend Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Set VITE_API_URL to your backend URL
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🚢 Railway Deployment

### Backend Deployment

1. **Create a new Railway service** for the backend
2. **Add PostgreSQL database** to your Railway project
3. **Set environment variables** in Railway dashboard:
   ```
   JWT_SECRET=your-strong-secret-key
   JWT_REFRESH_SECRET=your-strong-refresh-secret
   CORS_ORIGIN=https://your-frontend-domain.railway.app
   NODE_ENV=production
   ```
4. **Deploy** by connecting your repository and selecting the `backend` folder

### Frontend Deployment

1. **Update environment variables** in Railway:
   ```
   VITE_API_URL=https://your-backend-api.railway.app/api
   ```
2. **Deploy** using your existing Railway configuration

## 🔐 Authentication Features

- **Secure Login**: Email + password with validation
- **Role-based Access**: Admin and User roles
- **JWT Tokens**: Access tokens (15min) + Refresh tokens (7 days)
- **Auto Token Refresh**: Seamless session management
- **Admin Controls**: User management (admin-only registration)
- **Password Security**: Bcrypt hashing with salt rounds

## 👥 User Management

### Default Admin Account
- Email: `admin@rambley.com`
- Password: `AdminPass123!`
- Role: Admin

### Creating New Users
Only admins can create new user accounts through the backend API:

```bash
POST /api/auth/register
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

## 🛡️ Security Features

- Rate limiting on auth endpoints
- CORS protection
- Helmet.js security headers
- Password complexity requirements
- Token expiration and refresh
- Session invalidation on logout
- SQL injection protection with parameterized queries

## 📱 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create user (admin only)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `GET /api/users` - List users (admin only)
- `PUT /api/users/:id/toggle-active` - Toggle user status (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

## 🔄 Development Workflow

1. Make changes to your code
2. Test locally with both frontend and backend running
3. Commit and push to your repository
4. Railway will auto-deploy based on your branch settings

## 🐛 Troubleshooting

### Common Issues

1. **"Session expired" errors**: Clear localStorage and login again
2. **CORS errors**: Check CORS_ORIGIN environment variable
3. **Database connection issues**: Verify DATABASE_URL in Railway
4. **Token refresh failures**: Check JWT secrets match between deployments

### Logs

- **Backend logs**: Check Railway backend service logs
- **Frontend logs**: Check browser console and Railway frontend logs
- **Database logs**: Check Railway PostgreSQL logs

## 🔐 Security Recommendations

1. **Change default admin password** immediately after deployment
2. **Use strong JWT secrets** (generate with `openssl rand -base64 32`)
3. **Keep dependencies updated** with `npm audit`
4. **Monitor failed login attempts** in application logs
5. **Use HTTPS** in production (Railway provides this automatically)

---

Built with ❤️ using React, Node.js, and Railway
