import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WordEntry from './WordEntry';

describe('WordEntry Component', () => {
  const mockOnPlayAudio = jest.fn().mockResolvedValue(undefined);
  const mockOnOpenEtymology = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders word with number', () => {
    render(
      <WordEntry
        word="example"
        index={0}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('example')).toBeInTheDocument();
  });

  test('renders audio and etymology icons', () => {
    render(
      <WordEntry
        word="test"
        index={5}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    const audioButton = screen.getByLabelText('Play pronunciation for test');
    const etymologyButton = screen.getByLabelText('View etymology for test');

    expect(audioButton).toBeInTheDocument();
    expect(etymologyButton).toBeInTheDocument();
  });

  test('calls onPlayAudio when audio icon is clicked', async () => {
    render(
      <WordEntry
        word="hello"
        index={2}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    const audioButton = screen.getByLabelText('Play pronunciation for hello');
    fireEvent.click(audioButton);

    expect(mockOnPlayAudio).toHaveBeenCalledWith('hello');
    expect(mockOnPlayAudio).toHaveBeenCalledTimes(1);
  });

  test('calls onOpenEtymology when etymology icon is clicked', () => {
    render(
      <WordEntry
        word="world"
        index={3}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    const etymologyButton = screen.getByLabelText('View etymology for world');
    fireEvent.click(etymologyButton);

    expect(mockOnOpenEtymology).toHaveBeenCalledWith('world');
    expect(mockOnOpenEtymology).toHaveBeenCalledTimes(1);
  });

  test('applies word-hidden class when isHidden is true', () => {
    render(
      <WordEntry
        word="hidden"
        index={4}
        isHidden={true}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    const wordElement = screen.getByText('hidden');
    expect(wordElement).toHaveClass('word-hidden');
  });

  test('does not apply word-hidden class when isHidden is false', () => {
    render(
      <WordEntry
        word="visible"
        index={1}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    const wordElement = screen.getByText('visible');
    expect(wordElement).not.toHaveClass('word-hidden');
  });

  test('displays correct word number for different indices', () => {
    const { rerender } = render(
      <WordEntry
        word="first"
        index={0}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    expect(screen.getByText('1.')).toBeInTheDocument();

    rerender(
      <WordEntry
        word="tenth"
        index={9}
        isHidden={false}
        onPlayAudio={mockOnPlayAudio}
        onOpenEtymology={mockOnOpenEtymology}
      />
    );

    expect(screen.getByText('10.')).toBeInTheDocument();
  });
});
