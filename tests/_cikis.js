// Test bittiğinde açık kalan zamanlayıcılar (ör. sürüm kontrolü) süreci asılı bırakmasın.
setTimeout(() => process.exit(0), 10000).unref();
