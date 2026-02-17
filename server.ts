import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
    console.log(`🚀 CREator Backend running on http://localhost:${PORT}`);
    console.log(`   Ready to handle file operations and simulations`);
});
