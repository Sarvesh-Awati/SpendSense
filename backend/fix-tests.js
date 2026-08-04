const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'src', 'tests');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix catch (error: any)
  content = content.replace(/catch \(error: any\)/g, 'catch (error: unknown)');
  content = content.replace(/catch \(err: any\)/g, 'catch (err: unknown)');

  // Fix error.message or err.message
  content = content.replace(/error\.message/g, '(error instanceof Error ? error.message : String(error))');
  content = content.replace(/err\.message/g, '(err instanceof Error ? err.message : String(err))');
  
  // Fix mock parameters (args: any) =>
  content = content.replace(/\(args: any\) =>/g, '(args: unknown) =>');
  content = content.replace(/\(data: any\) =>/g, '(data: unknown) =>');

  // Fix prisma mocks (prisma.transaction as any)
  content = content.replace(/\(prisma\.(\w+) as any\)/g, '(prisma.$1 as unknown as Record<string, Function>)');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${file}`);
}
