import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
    origin: [FRONTEND_URL, 'http://localhost:5173']
}));
app.use(express.json());

// Path to cre-orchestrator .env file
const ORCHESTRATOR_PATH = process.env.ORCHESTRATOR_PATH || path.join(__dirname, '..', 'cre-orchestrator');
const CRE_ENV_PATH = path.join(ORCHESTRATOR_PATH, '.env');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Write file endpoint
app.post('/api/write-file', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;

        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'Missing path or content' });
        }

        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, content, 'utf-8');

        res.json({ success: true, message: `File written: ${filePath}` });
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({
            error: 'Failed to write file',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Simulate workflow endpoint
app.post('/api/simulate', async (req, res) => {
    try {
        const { orchestratorPath } = req.body;

        if (!orchestratorPath) {
            return res.status(400).json({ error: 'Missing orchestratorPath' });
        }

        // Change to orchestrator directory and run simulation
        // PowerShell uses semicolon (;) instead of && for command chaining
        const command = `cd "${orchestratorPath}"; cre workflow simulate workflows --target=staging-settings`;

        const { stdout, stderr } = await execAsync(command, {
            shell: 'powershell.exe',
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            timeout: 60000, // 60 second timeout
        });

        const output = stdout + (stderr ? '\n' + stderr : '');

        res.json({
            success: true,
            output: output,
        });
    } catch (error) {
        console.error('Error running simulation:', error);

        // Extract error output
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        const output = (execError.stdout || '') + '\n' + (execError.stderr || '') + '\n' + (execError.message || '');

        res.json({
            success: false,
            output: output,
        });
    }
});

// Get environment configuration status
app.get('/api/get-env-config', async (req, res) => {
    try {
        // Read .env file
        const envContent = await fs.readFile(CRE_ENV_PATH, 'utf-8');

        // Check if CRE_ETH_PRIVATE_KEY is set and not the placeholder
        const privateKeyMatch = envContent.match(/CRE_ETH_PRIVATE_KEY=(.+)/);
        const hasPrivateKey = privateKeyMatch &&
            privateKeyMatch[1].trim() !== '' &&
            privateKeyMatch[1].trim() !== 'your-eth-private-key';

        res.json({
            hasPrivateKey: !!hasPrivateKey,
        });
    } catch (error) {
        console.error('Error reading .env config:', error);
        res.status(500).json({
            error: 'Failed to read configuration',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Set environment configuration
app.post('/api/set-env-config', async (req, res) => {
    try {
        const { privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({ error: 'Private key is required' });
        }

        // Read current .env file
        let envContent = await fs.readFile(CRE_ENV_PATH, 'utf-8');

        // Update or add CRE_ETH_PRIVATE_KEY
        const privateKeyRegex = /CRE_ETH_PRIVATE_KEY=.*/;
        if (privateKeyRegex.test(envContent)) {
            // Replace existing key
            envContent = envContent.replace(privateKeyRegex, `CRE_ETH_PRIVATE_KEY=${privateKey}`);
        } else {
            // Add new key
            envContent += `\nCRE_ETH_PRIVATE_KEY=${privateKey}\n`;
        }

        // Write updated .env file
        await fs.writeFile(CRE_ENV_PATH, envContent, 'utf-8');

        res.json({
            success: true,
            message: 'Configuration saved successfully'
        });
    } catch (error) {
        console.error('Error updating .env config:', error);
        res.status(500).json({
            error: 'Failed to save configuration',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 CREator Backend running on http://localhost:${PORT}`);
    console.log(`   Ready to handle file operations and simulations`);
});
