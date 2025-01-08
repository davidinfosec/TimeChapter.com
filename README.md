# Time Chapter

Time Chapter is a comprehensive time management application built with [Next.js](https://nextjs.org). It allows users to log daily activities, manage todos, and customize their experience with themes and time settings. Whether you're tracking your daily tasks or reflecting on your productivity, Time Chapter provides the tools you need to stay organized and efficient.

## Features

- **User Authentication**: Secure login system with "Remember Me" functionality.
- **Logs Management**: Add, edit, and remove logs to document daily activities.
- **Todos Management**: Create, edit, and manage todos with automatic matching from logs.
- **Import & Export**: Easily import and export logs and todos in plain text format.
- **Customizable Settings**:
  - **Themes**: Switch between light and dark modes.
  - **Timezone**: Select your preferred timezone for accurate timestamping.
  - **Time Format**: Choose between 12-hour and 24-hour formats.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Local Storage**: Data is persisted locally per user for a seamless experience.

## Screenshots

![image](https://github.com/user-attachments/assets/50098224-7cd2-47db-a98f-ac522cd99cda)

*Dashboard showcasing logs and todos.*

![image](https://github.com/user-attachments/assets/56ff7f15-3260-486b-89a0-0c5417dd2b73)

*Settings modal with theme and timezone options.*

## Getting Started

### Prerequisites

Ensure you have **Node.js** and **npm** (or **yarn**, **pnpm**, **bun**) installed on your machine.

- [Download Node.js](https://nodejs.org/)

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/davidinfosec/TimeChapter.com.git
   cd TimeChapter.com
   ```

2. **Install Dependencies**

   Using **npm**:

   ```bash
   npm install
   ```

   Or using **yarn**:

   ```bash
   yarn install
   ```

   Or using **pnpm**:

   ```bash
   pnpm install
   ```

   Or using **bun**:

   ```bash
   bun install
   ```

### Running the Development Server

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Building for Production

To build the application for production:

```bash
npm run build
# or
yarn build
# or
pnpm build
# or
bun build
```

Start the production server:

```bash
npm start
# or
yarn start
# or
pnpm start
# or
bun start
```

## Usage

1. **Login**

   - Use the following mock credentials to log in:
     - **Username**: `admin`
     - **Password**: `admin`
     - **Username**: `user`
     - **Password**: `user`

2. **Manage Logs**

   - **Add Log**: Enter your activity in the "Add new log" field and press "Add" or hit Enter.
   - **Edit Log**: Click the edit icon (✎) next to a log to modify its time or content.
   - **Remove Log**: Click the remove icon (✕) to delete a log.
   - **Import Logs**: Use the import icon (⬆️) to import logs from a `.txt` file or paste text directly.
   - **Export Logs**: Click the save icon (💾) to export logs as a `.txt` file.
   - **Copy Logs**: Use the copy icon (📋) to copy all logs to your clipboard.

3. **Manage Todos**

   - **Add Todo**: Enter your task in the "Add new todo" field and press "Add" or hit Enter.
   - **Edit Todo**: Click the edit icon (✎) next to a todo to modify its content.
   - **Remove Todo**: Click the remove icon (✕) to delete a todo.
   - **Import Todos**: Use the import icon (⬆️) to import todos from a `.txt` file or paste text directly.
   - **Export Todos**: Click the save icon (💾) to export todos as a `.txt` file.
   - **Copy Todos**: Use the copy icon (📋) to copy all todos to your clipboard.
   - **Sync with Logs**: Automatically checks todos when matching logs are added. Manually override completion status as needed.

4. **Settings**

   - **Theme**: Toggle between light and dark modes.
   - **Timezone**: Select your preferred timezone to ensure accurate timestamps.
   - **Time Format**: Choose between 12-hour and 24-hour formats.

## Deployment

The easiest way to deploy your Next.js application is by using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme), created by the makers of Next.js.

### Deploy with Vercel

1. **Sign Up / Log In** to [Vercel](https://vercel.com/).

2. **Import Project**:
   - Click on "New Project".
   - Select your Git repository (e.g., GitHub, GitLab, Bitbucket).
   - Follow the prompts to configure your project.

3. **Configure Settings**:
   - Ensure the **Framework Preset** is set to **Next.js**.
   - Adjust any environment variables if necessary.

4. **Deploy**:
   - Click "Deploy" and wait for Vercel to build and deploy your application.
   - Once deployed, you can access your app via the provided URL.

For more details, refer to the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## Technologies Used

- [Next.js](https://nextjs.org) - React framework for production.
- [React](https://reactjs.org) - JavaScript library for building user interfaces.
- [Lucide React](https://lucide.dev/) - Icon library.
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework.
- [Local Storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) - Client-side storage for persisting user data.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or feature requests.

1. **Fork the repository**

2. **Create a new branch**

   ```bash
   git checkout -b feature/YourFeature
   ```

3. **Commit your changes**

   ```bash
   git commit -m "Add some feature"
   ```

4. **Push to the branch**

   ```bash
   git push origin feature/YourFeature
   ```

5. **Open a Pull Request**

## License

[MIT](./LICENSE)

## Acknowledgements

- Inspired by various time management and productivity tools.
- Built with ❤️ using Next.js and React.

## Contact

For any inquiries or support, please contact [timechapter@davidinfosec.com](mailto:timechapter@davidinfosec.com).

---

*This project is bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).*
