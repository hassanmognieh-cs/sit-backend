import { Component, OnInit, inject } from '@angular/core';
import { ChatbotService } from '../../services/chatbot.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';



interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})

export class ChatbotComponent implements OnInit {

  private chatbotService = inject(ChatbotService);//to send question to cahtbot
  private authService = inject(AuthService);//role user

  messages: ChatMessage[] = [
    { sender: 'bot', text: "Hello! 👋 I'm your Smart Inventory Assistant. How can I help you today?" }
  ];

  userInput: string = '';
  isLoading: boolean = false;
  showRecommendations: boolean = true;

  questionRecommendations: string[] = [];

  // All recommendations (for managers/admins)
  private allRecommendations: string[] = [
    "What products are low in stock?",
    "Show me the total inventory value",
    "Which products have expired?",
    "What are the top selling products?",
    "How much profit did we make this month?",
    "Which suppliers do we work with?",
    "Show me products expiring soon",
    "What is the current stock level?"
  ];

  // Employee-only recommendations (products and categories only)
  private employeeRecommendations: string[] = [
    "What products are low in stock?",
    "Which products have expired?",
    "Show me products expiring soon",
    "What is the price of [product name]?",
    "How many [product name] do I have in stock?",
    "What category does [product name] belong to?"
  ];

  ngOnInit() {
    // Filter recommendations based on user role
    this.authService.role$.subscribe(role => {
      if (role === 'employee') {
        this.questionRecommendations = [...this.employeeRecommendations];
      } else {
        this.questionRecommendations = [...this.allRecommendations];
      }
    });
  }

  sendMessage(questionText?: string) {
    const question = questionText || this.userInput.trim();
    if (!question) return;

    // show user message
    this.messages.push({ sender: 'user', text: question });
    this.userInput = '';//inside disqution
    // Keep recommendations visible after answering
    this.isLoading = true;

    // call backend
    this.chatbotService.askQuestion(question).subscribe({
      next: (res) => {
        this.messages.push({ sender: 'bot', text: res.answer });
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: () => {
        this.messages.push({
          sender: 'bot',
          text: "Sorry, something went wrong 😢. Try again."
        });
        this.isLoading = false;
      }
    });
  }

  selectRecommendation(question: string) {
    this.sendMessage(question);
  }

  private scrollToBottom() {
    setTimeout(() => {
      const chatBody = document.querySelector('.chat-body');
      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, 100);
  }
}
