import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? [FRONTEND_URL] 
        : [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: NODE_ENV,
        message: NODE_ENV === 'production' 
            ? 'Backend is running. File operations disabled in production.' 
            : 'Backend is running in development mode.',
        timestamp: new Date().toISOString()
    });
});

// API Info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'CREator Backend API',
        version: '1.0.0',
        environment: NODE_ENV,
        availableEndpoints: NODE_ENV === 'production'
            ? ['/health', '/api/info']
            : ['/health', '/api/info', '/api/write-file', '/api/simulate', '/api/get-env-config', '/api/set-env-config']
    });
});

// ============================================================================
// PRODUCTION MODE: Disabled endpoints
// ============================================================================
if (NODE_ENV === 'production') {
    const productionDisabledMessage = {
        error: 'Not available in production',
        message: 'This feature requires local filesystem access. Use "Export Flow" to download your project and test locally with CRE CLI.',
        documentation: 'https://docs.chain.link/cre'
    };

    app.post('/api/write-file', (req, res) => {
        res.status(501).json(productionDisabledMessage);
    });

    app.post('/api/simulate', (req, res) => {
        res.status(501).json(productionDisabledMessage);
    });

    app.get('/api/get-env-config', (req, res) => {
        res.status(501).json(productionDisabledMessage);
    });

    app.post('/api/set-env-config', (req, res) => {
        res.status(501).json(productionDisabledMessage);
    });

    console.log('🚀 CREator Backend running in PRODUCTION mode');
    console.log('⚠️  File operations are DISABLED');
    console.log('✅ Frontend should use "Export Flow" for project generation');
}

// ============================================================================
// DEVELOPMENT MODE: Full functionality
// ============================================================================
if (NODE_ENV === 'development') {
    // Import development server with full functionality
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const execAsync = promisify(exec);

    const ORCHESTRATOR_PATH = process.env.ORCHESTRATOR_PATH || path.join(__dirname, '..', 'cre-orchestrator');
    const CRE_ENV_PATH = path.join(ORCHESTRATOR_PATH, '.env');

    // Write file endpoint
    app.post('/api/write-file', async (req, res) => {
        try {
            const { path: filePath, content } = req.body;

            if (!filePath || content === undefined) {
                return res.status(400).json({ error: 'Missing path or content' });
            }

            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
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

            const command = `cd "${orchestratorPath}"; cre workflow simulate workflows --target=staging-settings`;

            const { stdout, stderr } = await execAsync(command, {
                shell: 'powershell.exe',
                maxBuffer: 1024 * 1024 * 10,
                timeout: 60000,
            });

            const output = stdout + (stderr ? '\n' + stderr : '');

            res.json({
                success: true,
                output: output,
            });
        } catch (error) {
            console.error('Error running simulation:', error);

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
            const envContent = await fs.readFile(CRE_ENV_PATH, 'utf-8');
            const hasPrivateKey = envContent.includes('CRE_ETH_PRIVATE_KEY=') && 
                                  !envContent.includes('CRE_ETH_PRIVATE_KEY=your_');

            res.json({
                configured: hasPrivateKey,
                path: CRE_ENV_PATH,
            });
        } catch (error) {
            res.json({
                configured: false,
                error: 'Could not read .env file',
            });
        }
    });

    // Set environment configuration
    app.post('/api/set-env-config', async (req, res) => {
        try {
            const { privateKey } = req.body;

            if (!privateKey) {
                return res.status(400).json({ error: 'Missing privateKey' });
            }

            const cleanKey = privateKey.replace(/^0x/, '').trim();

            if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
                return res.status(400).json({ 
                    error: 'Invalid private key format. Must be 64 hexadecimal characters.' 
                });
            }

            const envContent = `CRE_ETH_PRIVATE_KEY=${cleanKey}\nCRE_TARGET=staging-settings\n`;
            await fs.writeFile(CRE_ENV_PATH, envContent, 'utf-8');

            res.json({ 
                success: true, 
                message: 'Private key configured successfully' 
            });
        } catch (error) {
            console.error('Error setting env config:', error);
            res.status(500).json({
                error: 'Failed to save configuration',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    console.log('🧪 CREator Backend running in DEVELOPMENT mode');
    console.log('✅ All file operations are ENABLED');
    console.log(`📁 Orchestrator path: ${ORCHESTRATOR_PATH}`);
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} does not exist`,
        availableRoutes: NODE_ENV === 'production'
            ? ['/health', '/api/info']
            : ['/health', '/api/info', '/api/write-file', '/api/simulate', '/api/get-env-config', '/api/set-env-config']
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔗 CREator Backend API`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🎯 CORS Origin: ${FRONTEND_URL}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);
});

export default app;
