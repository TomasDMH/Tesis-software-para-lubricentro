const { execSync } = require('child_process');

try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
    console.log('[Hooks] core.hooksPath configurado en .githooks');
} catch (error) {
    console.log('[Hooks] No se configuraron hooks (fuera de un repo Git o Git no disponible).');
}
