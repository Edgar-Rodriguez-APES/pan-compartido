# Pan Compartido - Technology Stack

## Frontend Stack
- **Framework**: React 18.2.0 with Create React App
- **Styling**: Tailwind CSS 3.4.17 with PostCSS and Autoprefixer
- **Icons**: Lucide React
- **Routing**: React Router DOM 6.8.0
- **State Management**: React Query 3.39.3 for server state, React Context for app state
- **HTTP Client**: Axios 1.6.0
- **Testing**: Jest with React Testing Library

## Backend Stack
- **Runtime**: Node.js with Express 4.18.2
- **Database**: PostgreSQL with Knex.js 3.0.1 for migrations and query building
- **Cache**: Redis 4.6.10 for sessions and frequent data
- **Authentication**: JWT (jsonwebtoken 9.0.2) with bcryptjs 2.4.3 for password hashing
- **Validation**: Joi 17.11.0 for request validation
- **Security**: Helmet 7.1.0, CORS 2.8.5
- **File Upload**: Multer 1.4.5
- **Email**: Nodemailer 6.9.7
- **Payments**: Stripe 14.5.0
- **WhatsApp**: whatsapp-web.js 1.23.0
- **Scheduling**: node-cron 3.0.3
- **Logging**: Winston 3.11.0
- **Testing**: Jest 29.7.0 with Supertest 6.3.3

## Development Tools
- **Backend Dev Server**: Nodemon 3.0.1
- **Environment**: dotenv 16.3.1
- **Code Quality**: ESLint (React App config)

## Common Commands

### Frontend Development
```bash
npm start          # Start development server (localhost:3000)
npm run build      # Create production build
npm test           # Run tests
npm run eject      # Eject from Create React App (not recommended)
```

### Backend Development
```bash
npm run dev        # Start development server with nodemon (localhost:3001)
npm start          # Start production server
npm run migrate    # Run database migrations
npm run seed       # Seed database with test data
npm test           # Run backend tests
npm run test:watch # Run tests in watch mode
```

### Database Management
```bash
# From backend directory
npm run migrate    # Apply latest migrations
npm run seed       # Load seed data
```

### Full Stack Development
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
npm start
```

## Environment Configuration
- Backend uses `.env` file (see `.env.example` for template)
- Frontend environment variables must be prefixed with `REACT_APP_`
- Database: PostgreSQL with connection pooling in production
- Redis: Used for session storage and caching