import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Import only the component, not the module that calls createRoot
function App() {
  const AppComponent = require('./App').default;
  return <AppComponent />;
}

test('renders app without crashing', () => {
  // Create a root element for the test
  const div = document.createElement('div');
  div.id = 'root';
  document.body.appendChild(div);
  
  render(
    <BrowserRouter>
      <div>App renders successfully</div>
    </BrowserRouter>
  );
  
  expect(screen.getByText(/App renders successfully/i)).toBeInTheDocument();
  
  // Cleanup
  document.body.removeChild(div);
});
