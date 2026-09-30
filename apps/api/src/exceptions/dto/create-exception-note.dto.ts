import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class CreateExceptionNoteDto { @IsString() @IsNotEmpty() @MaxLength(1000) body!: string; }
