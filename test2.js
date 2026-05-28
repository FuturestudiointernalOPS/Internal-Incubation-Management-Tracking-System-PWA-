const parser = require('@babel/parser');
try {
  parser.parse('const x = <><DashboardLayout><div className="space-y-8"></div></div>{activePDF}</DashboardLayout></>;', {plugins:['jsx']});
} catch(e) {
  console.error('Error:', e.message);
}
