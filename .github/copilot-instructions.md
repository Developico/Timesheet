# Project Instructions

## Server Management
- After any operation that requires a server restart, check if the server is running and close it first. Only then suggest starting a new instance.
- Use `npx kill-port 3000` to properly terminate the development server before starting a new one
- Always verify server status before making changes that affect the running application

## Git Operations
- Do not perform automatic commit and push operations to git. Inform me when you think it's necessary and wait for my confirmation. Only execute these actions after receiving approval.
- Always check git status before suggesting commits
- Provide clear commit messages in English when commits are approved

## General Guidelines
- All labels and interface elements should be named in English
- Add code comments in English
- Always follow good security practices
- Follow RESTful API design principles
- Use scripts to perform actions when available

## Development Practices
- Use TypeScript for type safety across the application
- Follow Next.js 13+ app directory structure and conventions
- Implement proper error handling and user feedback
- Use shadcn/ui components consistently for UI elements
- Maintain consistent styling with Tailwind CSS
- Follow React best practices for component composition and state management

## Database and Data Management
- Use proper data validation and sanitization
- Implement efficient caching strategies where appropriate
- Follow database best practices for queries and relationships
- Maintain data consistency across the application

## Authentication and Security
- Implement proper authentication flows using NextAuth.js
- Follow security best practices for API endpoints
- Validate user permissions before data operations
- Protect sensitive routes and API endpoints

## Code Quality
- Write clean, maintainable, and well-documented code
- Use consistent naming conventions throughout the project
- Implement proper error boundaries and fallback UI
- Follow accessibility guidelines for UI components
- Optimize performance where necessary