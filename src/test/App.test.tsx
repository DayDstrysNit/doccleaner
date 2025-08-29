import { render, screen } from '@testing-library/react';
import App from '../renderer/App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByText('DOCX Web Converter')).toBeInTheDocument();
  });

  it('renders the application description', () => {
    render(<App />);
    expect(
      screen.getByText(
        'Convert Microsoft Word documents to clean, web-ready text'
      )
    ).toBeInTheDocument();
  });
});
