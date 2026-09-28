import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './auth-user.interface.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return {
      id: request.user.id,
      email: request.user.email,
      roles: request.user.roles,
      organizationIds: request.user.organizationIds,
      permissions: request.user.permissions,
    };
  }
}