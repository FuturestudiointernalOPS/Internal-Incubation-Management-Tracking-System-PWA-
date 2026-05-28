const parser = require('@babel/parser');
try {
  parser.parse('const x = <DashboardLayout>{true && ( <div> </div> )</DashboardLayout>;', {plugins:['jsx']});
} catch(e) {
  console.error('Error 1:', e.message);
}
try {
  parser.parse('const x = <DashboardLayout><div></div></div><div /></DashboardLayout>;', {plugins:['jsx']});
} catch(e) {
  console.error('Error 2:', e.message);
}
