# School Dashboard Backend

This is the backend for the School Dashboard application, built with NestJS and Prisma.

## Table of Contents

- [Installation](#installation)
- [Running the app](#running-the-app)
- [Test](#test)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [License](#license)

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/Ejay02/school_dash_be.git
   cd school_dash_be
   ```

2. Install the dependencies:

   ```sh
   npm install
   ```

## Running the app

1. Start the development server:

   ```sh
   npm run start:dev
   ```

2. The server will be running at `http://localhost:3000`.

## Test

1. Run unit tests:

   ```sh
   npm run test
   ```

2. Run end-to-end tests:

   ```sh
   npm run test:e2e
   ```

3. Run test coverage:

   ```sh
   npm run test:cov
   ```

## Environment Variables

Create a file in the root directory and add the following environment variables:

```env
DATABASE_URL=your_database_url  #To connect to db via docker
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
```

## Database

Generate Prisma client:

```sh
npx prisma generate
```

### Run Prisma migrations:

```sh
npx prisma migrate dev --name init
```

### View Interface

```sh
npx prisma studio
```

License
This project is licensed under the MIT License.
